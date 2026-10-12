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
    max_speed: Annotated[float, Field(ge=0, le=2000, allow_inf_nan=False)] | None = None
    gates: Annotated[int, Field(ge=0, le=1_000_000, strict=True)] | None = None
    misses: Annotated[int, Field(ge=0, le=1_000_000, strict=True)] | None = None
    sectors: Annotated[int, Field(ge=0, le=1_000_000, strict=True)] | None = None
    lives: Annotated[int, Field(ge=0, le=3, strict=True)] | None = None
    highest_tile: Annotated[int, Field(ge=0, le=1_048_576, strict=True)] | None = None
    completed: bool | None = None
    medal: Literal["gold", "silver", "bronze"] | None = None


class SessionRecord(RequestSchema):
    metrics: SessionMetrics = Field(default_factory=SessionMetrics)
    playtime_seconds: Playtime
    score: Score = 0
    difficulty: Difficulty | None = None
    session_id: UUID | None = None


class ScoreSubmit(RequestSchema):
    score: Score


class CompletionRecord(SessionRecord):
    session_id: UUID
    mode: str = Field("classic", pattern=r"^[a-z0-9-]{1,40}$")
    rules_version: int = Field(1, ge=1, le=10000, strict=True)


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
    mode: str = "classic"
    rules_version: int = 1
