"""Session identities and bounded gameplay statistics."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import RequestSchema, ResponseSchema

Score = Annotated[int, Field(ge=0, le=2_147_483_647, strict=True)]
Playtime = Annotated[int, Field(ge=0, le=7 * 24 * 60 * 60, strict=True)]
Difficulty = Literal["easy", "normal", "hard"]


class SessionStart(RequestSchema):
    session_id: UUID | None = None


class SessionMetrics(RequestSchema):
    jumps: Annotated[int, Field(ge=0, le=1_000_000, strict=True)] | None = None
    max_altitude: Annotated[float, Field(ge=0, le=10_000_000, allow_inf_nan=False)] | None = None
    crashed: bool | None = None


class SessionRecord(RequestSchema):
    metrics: SessionMetrics = Field(default_factory=SessionMetrics)
    playtime_seconds: Playtime
    score: Score = 0
    difficulty: Difficulty | None = None
    session_id: UUID | None = None


class ScoreSubmit(RequestSchema):
    score: Score


class GameStatsResponse(ResponseSchema):
    game_slug: str
    game_title: str
    total_playtime_seconds: int
    sessions_count: int
    high_score: int
    last_session: datetime | None = None


class StatsResponse(ResponseSchema):
    total_playtime_seconds: int
    total_games_played: int
    total_sessions: int
    games: list[GameStatsResponse]


class SessionStartResponse(ResponseSchema):
    message: str
    sessions_count: int
    session_id: UUID
    profile_id: int


class SessionRecordResponse(ResponseSchema):
    message: str
    total_playtime: int
    session_id: UUID


class ScoreResponse(ResponseSchema):
    message: str
    is_new_high_score: bool
    high_score: int


class SessionResponse(ResponseSchema):
    metrics: dict
    id: int
    session_id: UUID | None
    game_slug: str
    game_title: str
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    score: int
    difficulty: str | None
