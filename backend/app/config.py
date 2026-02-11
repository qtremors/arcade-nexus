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
    APP_VERSION: str = "1.4.1"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./arcade_nexus.db"
    
    # Security
    SECRET_KEY: str = ""
    
    # CORS
    # Default to standard frontend development ports
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def model_post_init(self, __context) -> None:
        """Generate secret key if not provided."""
        if not self.SECRET_KEY:
            # Fallback to random key for development
            # NOTE: In production, always provide SECRET_KEY via environment variable
            key = _generate_secret_key()
            object.__setattr__(self, 'SECRET_KEY', key)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
