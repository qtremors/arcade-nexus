"""Portable, validated backups. Restore creates copies instead of overwriting players."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import RequestSchema, ResponseSchema, Slug
from app.schemas.save import SaveCreate, SaveUpdate
from app.schemas.stats import CompletionRecord, Score
from app.schemas.user import ProfileCreate


class SavedSlot(SaveCreate):
    created_at: datetime
    updated_at: datetime


class SavedSession(CompletionRecord):
    start_time: datetime
    end_time: datetime


class SavedReservation(RequestSchema):
    session_id: UUID
    start_time: datetime


class SavedRecord(RequestSchema):
    mode: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    difficulty: Literal["easy", "normal", "hard"]
    rules_version: int = Field(ge=1, le=10000)
    high_score: Score


class SavedAward(RequestSchema):
    slug: Slug
    unlocked_at: datetime


class SavedGame(RequestSchema):
    slug: Slug
    favorite: bool = False
    playtime: int = Field(0, ge=0, le=2**53 - 1)
    sessions_count: int = Field(0, ge=0, le=2**31 - 1)
    high_score: Score = 0
    last_session: datetime | None = None
    saves: list[SavedSlot] = Field(default_factory=list, max_length=5)
    sessions: list[SavedSession] = Field(default_factory=list, max_length=100000)
    reservations: list[SavedReservation] = Field(default_factory=list, max_length=100000)
    records: list[SavedRecord] = Field(default_factory=list, max_length=1000)
    awards: list[SavedAward] = Field(default_factory=list, max_length=1000)
    recovery: SaveUpdate | None = None


class SavedPlayer(ProfileCreate):
    original_id: int = Field(ge=1)
    created_at: datetime
    games: list[SavedGame] = Field(default_factory=list, max_length=1000)


class Backup(RequestSchema):
    format: Literal[1]
    profiles: list[SavedPlayer] = Field(max_length=1000)


class SnapshotDownload(ResponseSchema):
    """Portable file wrapper, also used by browser-created backups."""

    format: Literal["arcade-nexus-backup-1"]
    database: Backup
    browser: dict[str, str] = Field(default_factory=dict)


class BackupPreview(ResponseSchema):
    profiles: int
    profile_ids: list[int]
    names: list[str]
    games: int
    saves: int
    sessions: int
    records: int
    recoveries: int


class BackupImport(ResponseSchema):
    imported: int
    profile_map: dict[str, int]
    session_map: dict[str, str]


class SnapshotInfo(ResponseSchema):
    name: str
    created_at: datetime
    reason: Literal["daily", "manual"]
    bytes: int


class BackupStatus(ResponseSchema):
    enabled: bool
    retention: int
    interval_hours: float
    backups: list[SnapshotInfo]
    error: str | None
