"""
Schemas Package
"""

from app.schemas.achievement import AchievementListResponse, AchievementResponse, AchievementUnlock
from app.schemas.game import GameCreate, GameListResponse, GameResponse
from app.schemas.library import LibraryAddResponse, LibraryEntryResponse
from app.schemas.save import SaveCreate, SaveListResponse, SaveResponse, SaveUpdate
from app.schemas.stats import (
    GameStatsResponse,
    ScoreResponse,
    ScoreSubmit,
    SessionRecord,
    SessionRecordResponse,
    SessionResponse,
    SessionStart,
    SessionStartResponse,
    StatsResponse,
)
from app.schemas.user import ProfileCreate, ProfileListResponse, ProfileResponse, ProfileUpdate

__all__ = [
    "ProfileCreate",
    "ProfileUpdate",
    "ProfileResponse",
    "ProfileListResponse",
    "GameCreate",
    "GameResponse",
    "GameListResponse",
    "LibraryEntryResponse",
    "LibraryAddResponse",
    "SaveCreate",
    "SaveUpdate",
    "SaveResponse",
    "SaveListResponse",
    "StatsResponse",
    "SessionRecord",
    "ScoreSubmit",
    "AchievementResponse",
    "AchievementUnlock",
    "AchievementListResponse",
    "GameStatsResponse",
    "SessionStart",
    "SessionStartResponse",
    "SessionRecordResponse",
    "SessionResponse",
    "ScoreResponse",
]
