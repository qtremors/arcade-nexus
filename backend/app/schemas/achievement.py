"""
Achievement Schemas
"""
from datetime import datetime
from pydantic import BaseModel


class AchievementResponse(BaseModel):
    """Schema for achievement data."""
    id: int
    game_slug: str
    slug: str
    title: str
    description: str | None = None
    icon: str | None = None
    unlocked: bool = False
    unlocked_at: datetime | None = None
    
    class Config:
        from_attributes = True


class AchievementUnlock(BaseModel):
    """Schema for unlocking an achievement."""
    achievement_slug: str
    game_slug: str


class AchievementListResponse(BaseModel):
    """Schema for list of achievements."""
    achievements: list[AchievementResponse]
    total: int
    unlocked_count: int
