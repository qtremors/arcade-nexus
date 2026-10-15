"""Portable, validated backups. Restore creates copies instead of overwriting players."""

import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from starlette.responses import FileResponse

from app.dependencies import DbSession
from app.schemas.backup import (
    Backup,
    BackupImport,
    BackupPreview,
    BackupStatus,
    SnapshotDownload,
    SnapshotInfo,
)
from app.services import backup_transfer as transfer

router = APIRouter()


@router.get("/backups", response_model=BackupStatus)
async def list_backups(request: Request):
    manager = request.app.state.backups
    return {
        "enabled": manager.enabled,
        "retention": manager.retention,
        "interval_hours": manager.interval / 3600,
        "backups": manager.snapshots(),
        "error": manager.error,
    }


@router.post("/backups", response_model=SnapshotInfo)
async def create_backup(request: Request):
    manager = request.app.state.backups
    if not manager.enabled:
        raise HTTPException(409, "Automatic backups are disabled for this console")
    try:
        snapshot = await manager.create(force=True)
    except Exception:
        raise HTTPException(503, manager.error) from None
    if snapshot is None:
        raise HTTPException(409, "Create a player before taking a backup")
    return snapshot


def snapshot_path(request: Request, name: str):
    path = request.app.state.backups.path(name)
    if path is None:
        raise HTTPException(404, "This backup is no longer available")
    return path


@router.get("/backups/{name}", response_model=SnapshotDownload)
async def download_backup(name: str, request: Request):
    return FileResponse(
        snapshot_path(request, name),
        media_type="application/json",
        filename=name,
        headers={"Cache-Control": "no-store"},
    )


async def saved_backup(name: str, request: Request):
    path = snapshot_path(request, name)

    def read():
        wrapper = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(wrapper, dict) or wrapper.get("format") != "arcade-nexus-backup-1":
            raise ValueError("Unsupported stored backup format")
        return Backup.model_validate(wrapper["database"])

    try:
        return await asyncio.to_thread(read)
    except (ValueError, KeyError, OSError):
        raise HTTPException(422, "This stored backup could not be read") from None


@router.post("/backups/{name}/preview", response_model=BackupPreview)
async def preview_snapshot(name: str, request: Request, db: DbSession):
    return await preview_data(await saved_backup(name, request), db)


@router.post("/backups/{name}/restore", response_model=BackupImport)
async def restore_snapshot(name: str, request: Request, db: DbSession):
    return await import_data(await saved_backup(name, request), db)


@router.post("/preview", response_model=BackupPreview)
async def preview_data(backup: Backup, db: DbSession):
    return await transfer.preview_data(backup, db)


@router.get("/export", response_model=Backup)
async def export_data(db: DbSession):
    return await transfer.export_data(db)


@router.post("/import", response_model=BackupImport)
async def import_data(backup: Backup, db: DbSession):
    return await transfer.import_data(backup, db)
