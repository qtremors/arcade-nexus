"""Use the application's connection during startup, or create one for the CLI."""

import asyncio
from pathlib import Path

from alembic import context

from app import models  # noqa: F401 -- register all tables
from app.config import get_settings
from app.database import Base, backup_before_upgrade, make_engine


def run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    engine = make_engine(get_settings().DATABASE_URL)
    try:
        database = engine.url.database
        if database and database != ":memory:":
            Path(database).parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(backup_before_upgrade, Path(database))
        async with engine.begin() as connection:
            await connection.exec_driver_sql("BEGIN IMMEDIATE")
            await connection.run_sync(run_migrations)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=get_settings().DATABASE_URL,
        target_metadata=Base.metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    run_migrations(context.config.attributes["connection"])
else:
    asyncio.run(run_async_migrations())
