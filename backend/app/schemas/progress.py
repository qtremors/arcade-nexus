"""Explicit response contracts for completion, records, history and recovery."""

from datetime import datetime
from typing import Literal

from app.schemas.base import ResponseSchema
from app.schemas.stats import SessionResponse


class Award(ResponseSchema):
    slug: str
    title: str
    description: str | None


class CompletionReceipt(ResponseSchema):
    session_id: str
    high_score: int
    previous_high_score: int
    best_time_ms: int | None
    previous_best_time_ms: int | None
    is_new_best_time: bool
    is_new_high_score: bool
    awards: list[Award]
    medal: Literal["gold", "silver", "bronze"] | None
    total_playtime: int


class ModeRecord(ResponseSchema):
    game_slug: str
    player: str
    profile_id: int
    mode: str
    difficulty: str
    rules_version: int
    high_score: int
    best_time_ms: int | None


class HistoryResponse(ResponseSchema):
    sessions: list[SessionResponse]
    total: int
    skip: int
    limit: int


class HistoryGame(ResponseSchema):
    id: int
    slug: str
    title: str
    modes: list[str]


class HistoryOptions(ResponseSchema):
    games: list[HistoryGame]


class RecoveryResponse(ResponseSchema):
    game_slug: str
    data: dict
    updated_at: datetime


class SavedResponse(ResponseSchema):
    saved: bool


class DeletedResponse(ResponseSchema):
    deleted: bool
