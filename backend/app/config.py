"""
Environment Configuration
"""
import secrets
from pydantic_settings import BaseSettings
from functools import lru_cache


def _generate_secret_key() -> str:
    """Generate a secure random secret key."""
    return secrets.token_urlsafe(32)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    APP_NAME: str = "Arcade Nexus"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False  # Default to False for production safety
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./arcade_nexus.db"
    
    # JWT Auth - Generate secure key if not provided via environment
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def model_post_init(self, __context) -> None:
        """Generate secret key if not provided."""
        if not self.SECRET_KEY:
            # For local single-user app, generate a random key per session
            # In production, this should be set via environment variable
            object.__setattr__(self, 'SECRET_KEY', _generate_secret_key())


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
