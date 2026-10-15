"""Atomic portable snapshots with bounded retention beside the selected database."""

import asyncio
import json
import logging
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.datetime_utils import utc_now
from app.schemas.backup import Backup
from app.services.backup_transfer import export_data

logger = logging.getLogger(__name__)
SNAPSHOT = re.compile(r"auto-(\d{8}T\d{12}Z)-(daily|manual)-[a-f0-9]{8}\.json")


class RotatingBackups:
    def __init__(self, database, session_factory, *, enabled=True, retention=7, hours=24):
        self.directory = (
            Path(database).with_name(f"{Path(database).stem}-backups")
            if database and database != ":memory:"
            else None
        )
        self.session_factory = session_factory
        self.enabled = enabled and self.directory is not None
        self.retention = retention
        self.interval = hours * 3600
        self.lock = asyncio.Lock()
        self.error = None

    def snapshots(self):
        if not self.directory or not self.directory.exists():
            return []
        snapshots = []
        for path in self.directory.glob("auto-*.json"):
            match = SNAPSHOT.fullmatch(path.name)
            if not match or path.is_symlink() or not path.is_file():
                continue
            try:
                stamp = datetime.strptime(match[1], "%Y%m%dT%H%M%S%fZ").replace(tzinfo=UTC)
                size = path.stat().st_size
            except (OSError, ValueError):
                continue
            snapshots.append(
                {
                    "name": path.name,
                    "created_at": stamp.isoformat(),
                    "reason": match[2],
                    "bytes": size,
                }
            )
        return sorted(snapshots, key=lambda item: item["name"], reverse=True)

    def path(self, name):
        if not self.directory or not SNAPSHOT.fullmatch(name):
            return None
        path = self.directory / name
        return path if path.is_file() and not path.is_symlink() else None

    async def create(self, *, force=False):
        if not self.enabled:
            return None
        async with self.lock:
            snapshots = self.snapshots()
            now = utc_now()
            latest = next(
                (
                    datetime.fromisoformat(item["created_at"])
                    for item in snapshots
                    if datetime.fromisoformat(item["created_at"]) <= now
                ),
                None,
            )
            if not force and latest is not None and (now - latest).total_seconds() < self.interval:
                return None
            try:
                async with self.session_factory() as db:
                    data = Backup.model_validate(await export_data(db))
                if not data.profiles:
                    return None
                stamp = utc_now()
                reason = "manual" if force else "daily"
                name = f"auto-{stamp.strftime('%Y%m%dT%H%M%S%fZ')}-{reason}-{uuid4().hex[:8]}.json"
                wrapper = {
                    "format": "arcade-nexus-backup-1",
                    "database": data.model_dump(mode="json"),
                    "browser": {},
                }
                await asyncio.to_thread(
                    self._write,
                    name,
                    json.dumps(wrapper, ensure_ascii=False, allow_nan=False, separators=(",", ":")),
                )
                self.error = None
                return next(item for item in self.snapshots() if item["name"] == name)
            except Exception:
                self.error = (
                    "A backup could not be written. Check free disk space and folder permissions."
                )
                raise

    def _write(self, name, content):
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                prefix=".snapshot-",
                suffix=".tmp",
                dir=self.directory,
                delete=False,
            ) as file:
                temporary = Path(file.name)
                file.write(content)
                file.flush()
                os.fsync(file.fileno())
            temporary.replace(self.directory / name)
            # A clock correction must never prune the file we just created.
            others = [item for item in self.snapshots() if item["name"] != name]
            for snapshot in others[max(0, self.retention - 1) :]:
                (self.directory / snapshot["name"]).unlink(missing_ok=True)
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)

    async def run(self):
        if not self.enabled:
            return
        while True:
            await asyncio.sleep(min(self.interval, 3600))
            try:
                await self.create()
            except Exception:
                logger.exception("Automatic backup failed")
