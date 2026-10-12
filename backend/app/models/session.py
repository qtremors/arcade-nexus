"""
Game Session Model
Tracks individual gameplay sessions with detailed metrics.
"""

from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.datetime_utils import UTCDateTime, utc_now


class GameSession(Base):
    """Individual gameplay session details."""

    __tablename__ = "game_sessions"
    __table_args__ = (
        Index("ix_sessions_user_end", "user_id", "end_time", "id"),
        UniqueConstraint("session_id", name="uq_sessions_session_id"),
        CheckConstraint("duration_seconds >= 0 AND score >= 0", name="ck_sessions_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )

    start_time: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    end_time: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)

    metrics: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}", nullable=False)
    mode: Mapped[str] = mapped_column(String(40), default="classic", server_default="classic")
    rules_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    completion: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    game = relationship("Game", back_populates="sessions")

    def __repr__(self) -> str:
        return (
            f"<GameSession(id={self.id}, game={self.game_id}, duration={self.duration_seconds}s)>"
        )
