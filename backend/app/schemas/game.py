"""
Game Schemas
"""
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.game import Category


class GameCreate(BaseModel):
    """Schema for creating a game (admin use)."""
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    title: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    thumbnail: str | None = None
    category: Category = Category.ARCADE
    version: str = "1.0.0"
    config: dict | None = None


class GameResponse(BaseModel):
    """Schema for game data in responses."""
    id: int
    slug: str
    title: str
    description: str | None = None
    thumbnail: str | None = None
    category: Category
    version: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class GameListResponse(BaseModel):
    """Schema for paginated game list."""
    games: list[GameResponse]
    total: int
