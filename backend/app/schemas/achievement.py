"""
Achievement Schemas
"""

from datetime import datetime

from app.schemas.base import RequestSchema, ResponseSchema, Slug


class AchievementResponse(ResponseSchema):
    """Schema for achievement data."""

    unlock_condition: dict | None = None
    id: int
    game_slug: str
    slug: str
    title: str
    description: str | None = None
    icon: str | None = None
    unlocked: bool = False
    unlocked_at: datetime | None = None


class AchievementUnlock(RequestSchema):
    """Schema for unlocking an achievement."""

    achievement_slug: Slug
    game_slug: Slug


class AchievementSummary(ResponseSchema):
    """Counts without achievement descriptions or unlock rows."""

    total: int
    unlocked_count: int


class AchievementListResponse(AchievementSummary):
    """Schema for list of achievements."""

    achievements: list[AchievementResponse]


class UnlockedAchievement(ResponseSchema):
    title: str
    description: str | None


class AchievementUnlockResponse(ResponseSchema):
    message: str
    unlocked: bool
    achievement: UnlockedAchievement | None = None
