"""Fresh schemas, legacy adoption, backups, constraints, and failed-upgrade rollback."""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.config import BACKEND_DIR
from app.database import Base, init_db, make_engine


async def baseline(engine):
    async with engine.begin() as connection:
        await connection.exec_driver_sql("BEGIN IMMEDIATE")

        def create(connection):
            config = Config(str(BACKEND_DIR / "alembic.ini"))
            config.attributes["connection"] = connection
            command.upgrade(config, "0001")

        await connection.run_sync(create)


def legacy_rows(path):
    with closing(sqlite3.connect(path)) as db:
        stamp = "2026-02-11 12:00:00"
        db.execute("INSERT INTO users VALUES (1,'Legacy','🎮',1,1,?,?)", (stamp, stamp))
        db.execute("INSERT INTO users VALUES (2,'Second',NULL,1,1,?,NULL)", (stamp,))
        db.execute(
            "INSERT INTO games VALUES (1,'snake','Old Snake',NULL,NULL,'ARCADE','1.0.0',NULL,1,?)",
            (stamp,),
        )
        db.execute(
            "INSERT INTO game_saves VALUES (7,1,1,1,'Old Save','{\"score\":12}',NULL,?,?)",
            (stamp, stamp),
        )
        db.execute("INSERT INTO play_stats VALUES (9,1,1,10,1,12,?)", (stamp,))
        db.execute("INSERT INTO game_sessions VALUES (11,1,1,?,?,10,12,'normal')", (stamp, stamp))
        db.execute(
            "INSERT INTO achievements VALUES (13,1,'score-50','Legacy Award',NULL,NULL,NULL)"
        )
        db.execute("INSERT INTO achievements_unlocked VALUES (15,1,13,?)", (stamp,))
        db.commit()


async def test_fresh_schema_matches_models_and_enforces_constraints(tmp_path):
    engine = make_engine(f"sqlite+aiosqlite:///{tmp_path / 'fresh.db'}")
    try:
        await init_db(engine)
        async with engine.connect() as connection:
            assert (await connection.execute(text("PRAGMA foreign_keys"))).scalar() == 1
            assert (await connection.execute(text("PRAGMA journal_mode"))).scalar() == "wal"
            assert (await connection.execute(text("PRAGMA busy_timeout"))).scalar() == 10000

            def compare(connection):
                return compare_metadata(MigrationContext.configure(connection), Base.metadata)

            assert await connection.run_sync(compare) == []
        async with engine.begin() as connection:
            with pytest.raises(IntegrityError):
                await connection.execute(
                    text(
                        "INSERT INTO game_saves (user_id,game_id,slot,data,created_at,updated_at)"
                        " VALUES (999,999,1,'{}','2026-01-01','2026-01-01')"
                    )
                )
        await init_db(engine)  # already-upgraded databases need no new backup
        assert not list(tmp_path.glob("*.pre-*.db"))
    finally:
        await engine.dispose()


@pytest.mark.parametrize("versioned", [False, True])
async def test_legacy_upgrade_preserves_ids_progress_and_backups(tmp_path, versioned):
    path = tmp_path / "legacy.db"
    engine = make_engine(f"sqlite+aiosqlite:///{path}")
    try:
        await baseline(engine)
        await engine.dispose()
        legacy_rows(path)
        if not versioned:
            with closing(sqlite3.connect(path)) as db:
                db.execute("DROP TABLE alembic_version")
                db.commit()
        await init_db(engine)
        async with engine.connect() as connection:
            assert (
                await connection.execute(text("SELECT version_num FROM alembic_version"))
            ).scalar() == "0004"
            assert (
                await connection.execute(text("SELECT data FROM game_saves WHERE id=7"))
            ).scalar() == '{"score":12}'
            assert (
                await connection.execute(text("SELECT high_score FROM play_stats WHERE id=9"))
            ).scalar() == 12
            assert (
                await connection.execute(text("SELECT score FROM game_sessions WHERE id=11"))
            ).scalar() == 12
            assert (
                await connection.execute(
                    text("SELECT COUNT(*) FROM achievements_unlocked WHERE id=15")
                )
            ).scalar() == 1
            assert (
                await connection.execute(text("SELECT COUNT(*) FROM users WHERE is_default=1"))
            ).scalar() == 1
            assert (await connection.execute(text("PRAGMA foreign_key_check"))).all() == []
        backup = path.with_name(f"legacy.pre-{'0001' if versioned else 'legacy'}.db")
        assert backup.exists()
        with closing(sqlite3.connect(backup)) as db:
            assert db.execute("SELECT score FROM game_sessions WHERE id=11").fetchone()[0] == 12
            assert db.execute("SELECT COUNT(*) FROM users WHERE is_default=1").fetchone()[0] == 2
            assert "session_id" not in {
                row[1] for row in db.execute("PRAGMA table_info(game_sessions)")
            }
    finally:
        await engine.dispose()


async def test_failed_upgrade_rolls_back_all_schema_and_data_changes(tmp_path):
    path = tmp_path / "invalid.db"
    engine = make_engine(f"sqlite+aiosqlite:///{path}")
    try:
        await baseline(engine)
        await engine.dispose()
        legacy_rows(path)
        with closing(sqlite3.connect(path)) as db:
            db.execute("UPDATE game_saves SET slot=9")
            db.commit()
        with pytest.raises(IntegrityError):
            await init_db(engine)
        with closing(sqlite3.connect(path)) as db:
            assert db.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0001"
            assert db.execute("SELECT slot FROM game_saves WHERE id=7").fetchone()[0] == 9
            assert "session_id" not in {
                row[1] for row in db.execute("PRAGMA table_info(game_sessions)")
            }
            assert not db.execute(
                "SELECT name FROM sqlite_master WHERE name LIKE '_alembic_tmp_%'"
            ).fetchall()
        assert path.with_name("invalid.pre-0001.db").exists()
    finally:
        await engine.dispose()


async def test_incomplete_legacy_database_is_not_stamped(tmp_path):
    path = tmp_path / "partial.db"
    with closing(sqlite3.connect(path)) as db:
        db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        db.commit()
    engine = make_engine(f"sqlite+aiosqlite:///{path}")
    try:
        with pytest.raises(RuntimeError, match="Incomplete legacy"):
            await init_db(engine)
        with closing(sqlite3.connect(path)) as db:
            assert not db.execute(
                "SELECT 1 FROM sqlite_master WHERE name='alembic_version'"
            ).fetchone()
    finally:
        await engine.dispose()


async def test_migration_downgrade_and_upgrade_preserve_progress(tmp_path):
    path = tmp_path / "roundtrip.db"
    engine = make_engine(f"sqlite+aiosqlite:///{path}")
    try:
        await baseline(engine)
        await engine.dispose()
        legacy_rows(path)
        await init_db(engine)
        async with engine.begin() as connection:
            await connection.exec_driver_sql("BEGIN IMMEDIATE")

            def downgrade(connection):
                config = Config(str(BACKEND_DIR / "alembic.ini"))
                config.attributes["connection"] = connection
                command.downgrade(config, "0001")

            await connection.run_sync(downgrade)
        await init_db(engine)
        async with engine.connect() as connection:
            assert (
                await connection.execute(text("SELECT data FROM game_saves WHERE id=7"))
            ).scalar() == '{"score":12}'
            assert (
                await connection.execute(text("SELECT score FROM game_sessions WHERE id=11"))
            ).scalar() == 12
        assert len(list(tmp_path.glob("roundtrip.pre-0001*.db"))) == 2
    finally:
        await engine.dispose()


def test_locked_database_returns_retryable_error_and_recovers(player, settings):
    from sqlalchemy import event

    engine = player.app.state.engine
    player.portal.call(engine.dispose)

    @event.listens_for(engine.sync_engine, "connect")
    def short_timeout(connection, record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA busy_timeout=20")
        cursor.close()

    path = Path(settings.DATABASE_URL.removeprefix("sqlite+aiosqlite:///"))
    with closing(sqlite3.connect(path)) as locked:
        locked.execute("BEGIN IMMEDIATE")
        response = player.post("/api/stats/snake/score", json={"score": 100})
        assert response.status_code == 503
        assert response.headers["retry-after"] == "1"
        assert "SQL" not in response.json()["detail"]
        locked.rollback()
    assert player.post("/api/stats/snake/score", json={"score": 100}).status_code == 200


def test_health_checks_the_database_schema(client):
    async def drop_version():
        async with client.app.state.engine.begin() as connection:
            await connection.execute(text("DROP TABLE alembic_version"))

    client.portal.call(drop_version)
    assert client.get("/health").status_code == 503
