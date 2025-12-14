"""
Play Statistics Model
"""
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


class PlayStats(Base):
    """Play statistics per user per game."""
    
    __tablename__ = "play_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "game_id", name="unique_user_game_stats"),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    total_playtime_seconds: Mapped[int] = mapped_column(Integer, default=0)
    sessions_count: Mapped[int] = mapped_column(Integer, default=0)
    high_score: Mapped[int] = mapped_column(Integer, default=0)
    last_session: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="stats")
    game = relationship("Game", back_populates="stats")
    
    def __repr__(self) -> str:
        return f"<PlayStats(user_id={self.user_id}, game_id={self.game_id}, playtime={self.total_playtime_seconds}s)>"
