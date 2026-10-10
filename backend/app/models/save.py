"""
Game Save Model
"""

from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.datetime_utils import UTCDateTime, utc_now


class GameSave(Base):
    """Game save data model - stores save states per user per game."""

    __tablename__ = "game_saves"
    __table_args__ = (
        UniqueConstraint("user_id", "game_id", "slot", name="unique_user_game_slot"),
        CheckConstraint("slot BETWEEN 1 AND 5", name="ck_save_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slot: Mapped[int] = mapped_column(Integer, default=1)  # Save slot number (1-5)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Custom save name
    data: Mapped[dict] = mapped_column(JSON, nullable=False)  # Actual save data
    thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)  # Base64 screenshot
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="saves")
    game = relationship("Game", back_populates="saves")

    def __repr__(self) -> str:
        return f"<GameSave(user_id={self.user_id}, game_id={self.game_id}, slot={self.slot})>"
