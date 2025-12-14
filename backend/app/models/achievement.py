"""
Achievement Models
"""
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, DateTime, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


class Achievement(Base):
    """Achievement definition model."""
    
    __tablename__ = "achievements"
    __table_args__ = (
        UniqueConstraint("game_id", "slug", name="unique_game_achievement"),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unlock_condition: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # e.g., {"score": 100}
    
    # Relationships
    game = relationship("Game", back_populates="achievements")
    unlocks = relationship("AchievementUnlocked", back_populates="achievement", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Achievement(game_id={self.game_id}, slug='{self.slug}')>"


class AchievementUnlocked(Base):
    """Tracks which achievements a user has unlocked."""
    
    __tablename__ = "achievements_unlocked"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="unique_user_achievement"),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False, index=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="unlocks")
    
    def __repr__(self) -> str:
        return f"<AchievementUnlocked(user_id={self.user_id}, achievement_id={self.achievement_id})>"
