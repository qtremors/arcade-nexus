"""Bounded JSON saves; game-specific state validation belongs to the game SDK."""

from datetime import datetime
from typing import Annotated

from pydantic import Field, JsonValue, field_validator

from app.schemas.base import RequestSchema, ResponseSchema, validate_json_size

MAX_SAVE_DATA_SIZE = 1024 * 100
MAX_THUMBNAIL_SIZE = 1024 * 500
SaveSlot = Annotated[int, Field(ge=1, le=5, strict=True)]


class SaveUpdate(RequestSchema):
    name: str | None = Field(None, max_length=100)
    data: dict[str, JsonValue]
    thumbnail: str | None = Field(None, max_length=MAX_THUMBNAIL_SIZE)

    @field_validator("data")
    @classmethod
    def validate_data_size(cls, value: dict[str, JsonValue]) -> dict[str, JsonValue]:
        return validate_json_size(value, MAX_SAVE_DATA_SIZE)


class SaveCreate(SaveUpdate):
    slot: SaveSlot


class SaveResponse(ResponseSchema):
    id: int
    game_slug: str
    slot: int
    name: str | None = None
    data: dict[str, JsonValue]
    thumbnail: str | None = None
    created_at: datetime
    updated_at: datetime


class SaveListResponse(ResponseSchema):
    saves: list[SaveResponse]
    total: int
