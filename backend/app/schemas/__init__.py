"""
Schemas Package
"""
from app.schemas.user import ProfileCreate, ProfileUpdate, ProfileResponse, ProfileListResponse
from app.schemas.game import GameCreate, GameResponse, GameListResponse
from app.schemas.library import LibraryEntryResponse, LibraryAddResponse
from app.schemas.save import SaveCreate, SaveUpdate, SaveResponse, SaveListResponse
from app.schemas.stats import StatsResponse, SessionRecord, ScoreSubmit
from app.schemas.achievement import AchievementResponse, AchievementUnlock

__all__ = [
    "ProfileCreate", "ProfileUpdate", "ProfileResponse", "ProfileListResponse",
    "GameCreate", "GameResponse", "GameListResponse",
    "LibraryEntryResponse", "LibraryAddResponse",
    "SaveCreate", "SaveUpdate", "SaveResponse", "SaveListResponse",
    "StatsResponse", "SessionRecord", "ScoreSubmit",
    "AchievementResponse", "AchievementUnlock"
]
