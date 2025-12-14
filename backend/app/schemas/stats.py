"""
Stats Schemas
"""
from datetime import datetime
from pydantic import BaseModel, Field


class SessionRecord(BaseModel):
    """Schema for recording a play session."""
    playtime_seconds: int = Field(..., ge=0)


class ScoreSubmit(BaseModel):
    """Schema for submitting a high score."""
    score: int = Field(..., ge=0)


class GameStatsResponse(BaseModel):
    """Schema for stats of a single game."""
    game_slug: str
    game_title: str
    total_playtime_seconds: int
    sessions_count: int
    high_score: int
    last_session: datetime | None = None


class StatsResponse(BaseModel):
    """Schema for overall user stats."""
    total_playtime_seconds: int
    total_games_played: int
    total_sessions: int
    games: list[GameStatsResponse]
