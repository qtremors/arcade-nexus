"""
User Library Model - Games added by user
"""

from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.datetime_utils import UTCDateTime, utc_now


class UserLibrary(Base):
    """User's game library - tracks which games a user has added."""

    __tablename__ = "user_library"
    __table_args__ = (UniqueConstraint("user_id", "game_id", name="unique_user_game"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    added_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    last_played: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    # Relationships
    user = relationship("User", back_populates="library")
    game = relationship("Game", back_populates="library_entries")

    def __repr__(self) -> str:
        return f"<UserLibrary(user_id={self.user_id}, game_id={self.game_id})>"
