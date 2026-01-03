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
            # Check if .env file exists and read it manually to see if we missed it or if it's missing
            import os
            env_path = ".env"
            
            # If in dev mode, try to persist the key
            if not self.SECRET_KEY:
                key = _generate_secret_key()
                object.__setattr__(self, 'SECRET_KEY', key)
                
                # Try to append to .env
                try:
                    with open(env_path, "a") as f:
                        f.write(f"\nSECRET_KEY=\"{key}\"\n")
                    print(f"🔑 Generated and persisted new SECRET_KEY to {env_path}")
                except Exception as e:
                    if not self.DEBUG:
                        print(f"⚠️  WARNING: Could not persist SECRET_KEY: {e}")
                        print("Sessions will not persist across restarts.")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
