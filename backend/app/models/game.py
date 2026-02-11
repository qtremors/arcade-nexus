"""
Game Model
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, Boolean, Text, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.datetime_utils import utc_now


class Category(str, PyEnum):
    """Game category enum."""
    ARCADE = "arcade"
    PUZZLE = "puzzle"
    ACTION = "action"
    STRATEGY = "strategy"
    SIMULATION = "simulation"


class Game(Base):
    """Game metadata model."""
    
    __tablename__ = "games"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[Category] = mapped_column(Enum(Category), default=Category.ARCADE)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Game-specific settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    library_entries = relationship("UserLibrary", back_populates="game", cascade="all, delete-orphan")
    saves = relationship("GameSave", back_populates="game", cascade="all, delete-orphan")
    stats = relationship("PlayStats", back_populates="game", cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="game", cascade="all, delete-orphan")
    sessions = relationship("GameSession", back_populates="game", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Game(id={self.id}, slug='{self.slug}', title='{self.title}')>"
