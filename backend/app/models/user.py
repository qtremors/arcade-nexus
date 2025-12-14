"""
User Model - Local Profile System
"""
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    """User profile model for local multi-profile system."""
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Icon name or URL
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # Currently active profile
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    library = relationship("UserLibrary", back_populates="user", cascade="all, delete-orphan")
    saves = relationship("GameSave", back_populates="user", cascade="all, delete-orphan")
    stats = relationship("PlayStats", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("AchievementUnlocked", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', is_default={self.is_default})>"
