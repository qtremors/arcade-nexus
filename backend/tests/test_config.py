"""Stable local paths and explicit configuration validation."""

import pytest
from pydantic import ValidationError

from app.config import BACKEND_DIR, Settings


def test_defaults_use_application_data_without_creating_files(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.BACKEND_DIR", tmp_path / "backend")
    data = tmp_path / "data"
    settings = Settings(_env_file=None, DATABASE_URL="", DATA_DIR=data)
    assert settings.HOST == "127.0.0.1"
    assert settings.DATABASE_URL == f"sqlite+aiosqlite:///{data / 'arcade_nexus.db'}"
    assert not data.exists()


def test_existing_backend_database_is_retained(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.BACKEND_DIR", tmp_path)
    legacy = tmp_path / "arcade_nexus.db"
    legacy.touch()
    settings = Settings(_env_file=None, DATABASE_URL="", DATA_DIR=tmp_path / "new")
    assert settings.DATABASE_URL == f"sqlite+aiosqlite:///{legacy}"


def test_relative_database_url_is_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None, DATABASE_URL="sqlite+aiosqlite:///./relative.db")
    assert settings.DATABASE_URL == f"sqlite+aiosqlite:///{BACKEND_DIR / 'relative.db'}"


def test_obsolete_secret_key_is_ignored_without_fake_session_requirements():
    settings = Settings(_env_file=None, SECRET_KEY="legacy-unused-value")
    assert not hasattr(settings, "SECRET_KEY")


@pytest.mark.parametrize(
    "values",
    [
        {"PORT": 0},
        {"PORT": 65536},
        {"CORS_ORIGINS": ["*"]},
        {"DATABASE_URL": "postgresql+asyncpg://localhost/arcade"},
        {"MAX_REQUEST_BYTES": 1},
    ],
)
def test_invalid_configuration(values):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)
