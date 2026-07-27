"""SQLite connections, transactional sessions, and versioned schema upgrades."""

import asyncio
import sqlite3
from collections.abc import AsyncIterator
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import Request
from sqlalchemy import event, inspect
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import BACKEND_DIR


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str, *, debug: bool = False) -> AsyncEngine:
    url = make_url(database_url)
    kwargs = {"poolclass": StaticPool} if url.database in (None, "", ":memory:") else {}
    db_engine = create_async_engine(url, echo=debug, connect_args={"timeout": 10}, **kwargs)

    @event.listens_for(db_engine.sync_engine, "connect")
    def configure_sqlite(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    return db_engine


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        try:
            yield session
        except BaseException:
            await session.rollback()
            raise


def migrate(connection: Connection) -> None:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["connection"] = connection
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    if "alembic_version" not in tables:
        # This is the historical baseline, independent of future model additions.
        expected = {
            "users",
            "games",
            "user_library",
            "game_saves",
            "play_stats",
            "game_sessions",
            "achievements",
            "achievements_unlocked",
        }
        existing = tables & expected
        if existing:
            if existing != expected:
                raise RuntimeError("Incomplete legacy database; restore a backup before upgrading")
            legacy_columns = {
                "users": {
                    "id",
                    "username",
                    "avatar",
                    "is_active",
                    "is_default",
                    "created_at",
                    "last_login",
                },
                "games": {
                    "id",
                    "slug",
                    "title",
                    "description",
                    "thumbnail",
                    "category",
                    "version",
                    "config",
                    "is_active",
                    "created_at",
                },
                "user_library": {"id", "user_id", "game_id", "added_at", "last_played"},
                "game_saves": {
                    "id",
                    "user_id",
                    "game_id",
                    "slot",
                    "name",
                    "data",
                    "thumbnail",
                    "created_at",
                    "updated_at",
                },
                "play_stats": {
                    "id",
                    "user_id",
                    "game_id",
                    "total_playtime_seconds",
                    "sessions_count",
                    "high_score",
                    "last_session",
                },
                "game_sessions": {
                    "id",
                    "user_id",
                    "game_id",
                    "start_time",
                    "end_time",
                    "duration_seconds",
                    "score",
                    "difficulty",
                },
                "achievements": {
                    "id",
                    "game_id",
                    "slug",
                    "title",
                    "description",
                    "icon",
                    "unlock_condition",
                },
                "achievements_unlocked": {"id", "user_id", "achievement_id", "unlocked_at"},
            }
            for table, required in legacy_columns.items():
                actual = {column["name"] for column in inspector.get_columns(table)}
                if not required <= actual:
                    raise RuntimeError(
                        f"Unsupported legacy schema in {table}; restore or migrate it explicitly"
                    )
            command.stamp(config, "0001")
    command.upgrade(config, "head")


async def init_db(db_engine: AsyncEngine) -> None:
    database = db_engine.url.database
    if database and database != ":memory:":
        Path(database).parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(backup_before_upgrade, Path(database))
    async with db_engine.begin() as connection:
        # SQLite's default driver does not begin transactions for DDL. Make schema
        # upgrades transactional and serialize simultaneous local server startups.
        await connection.exec_driver_sql("BEGIN IMMEDIATE")
        await connection.run_sync(migrate)


def backup_before_upgrade(path: Path) -> None:
    """Use SQLite's backup API, including committed WAL contents, before upgrading."""
    if not path.exists() or path.stat().st_size == 0:
        return
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    scripts = ScriptDirectory.from_config(config)
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as source:
        source.execute("BEGIN")
        version = None
        if source.execute("SELECT 1 FROM sqlite_master WHERE name='alembic_version'").fetchone():
            row = source.execute("SELECT version_num FROM alembic_version").fetchone()
            version = row[0] if row else None
        if version in scripts.get_heads():
            return
        known = {revision.revision for revision in scripts.walk_revisions()}
        label = version if version in known else ("legacy" if version is None else "unknown")
        backup = path.with_name(f"{path.stem}.pre-{label}.db")
        if backup.exists():
            backup = path.with_name(f"{path.stem}.pre-{label}-{uuid4().hex[:12]}.db")
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            with closing(sqlite3.connect(temporary)) as destination:
                source.backup(destination)
            temporary.replace(backup)
        finally:
            temporary.unlink(missing_ok=True)
