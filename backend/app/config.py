"""Configuration for the local browser application."""

from functools import lru_cache
from pathlib import Path

from platformdirs import user_data_path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

from app.version import VERSION

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", case_sensitive=True, extra="ignore"
    )
    APP_NAME: str = "Arcade Nexus"
    APP_VERSION: str = VERSION
    DEBUG: bool = False
    DATA_DIR: Path = Field(default_factory=lambda: user_data_path("ArcadeNexus", appauthor=False))
    DATABASE_URL: str = ""
    HOST: str = "127.0.0.1"
    PORT: int = Field(8000, ge=1, le=65535)
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1", "[::1]"]
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
    ]
    ALLOW_GAME_CREATION: bool = False
    FRONTEND_DIR: Path | None = None
    MAX_REQUEST_BYTES: int = Field(1024 * 1024, ge=1024)
    AUTO_BACKUP_ENABLED: bool = True
    BACKUP_RETENTION: int = Field(7, ge=1, le=30)
    BACKUP_INTERVAL_HOURS: int = Field(24, ge=1, le=168)

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        if "*" in origins:
            raise ValueError("Use explicit browser origins instead of a wildcard")
        return origins

    def model_post_init(self, __context: object) -> None:
        self.DATA_DIR = self.DATA_DIR.expanduser().resolve()
        if not self.DATABASE_URL:
            legacy = BACKEND_DIR / "arcade_nexus.db"
            path = legacy if legacy.exists() else self.DATA_DIR / "arcade_nexus.db"
            self.DATABASE_URL = f"sqlite+aiosqlite:///{path.as_posix()}"
        url = make_url(self.DATABASE_URL)
        if url.drivername != "sqlite+aiosqlite":
            raise ValueError("Arcade Nexus requires a sqlite+aiosqlite database URL")
        if url.database and url.database != ":memory:":
            path = Path(url.database).expanduser()
            if not path.is_absolute():
                path = BACKEND_DIR / path
            self.DATABASE_URL = str(url.set(database=path.resolve().as_posix()))


@lru_cache
def get_settings() -> Settings:
    return Settings()
