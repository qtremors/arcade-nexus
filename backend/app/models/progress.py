"""Mode-specific records and automatic recovery, independent of manual slots."""

from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.datetime_utils import UTCDateTime, utc_now


class GameRecord(Base):
    __tablename__ = "game_records"
    __table_args__ = (
        UniqueConstraint("user_id", "game_id", "mode", "difficulty", "rules_version"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    mode: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[str] = mapped_column(String(20))
    rules_version: Mapped[int] = mapped_column(Integer)
    high_score: Mapped[int] = mapped_column(Integer, default=0)


class RecoverySave(Base):
    __tablename__ = "recovery_saves"
    __table_args__ = (UniqueConstraint("user_id", "game_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
