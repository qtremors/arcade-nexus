"""Validated catalog metadata."""

from datetime import datetime
from typing import Annotated

from pydantic import Field, JsonValue, StringConstraints, field_validator

from app.models.game import Category
from app.schemas.base import RequestSchema, ResponseSchema, Slug, validate_json_size


class GameCreate(RequestSchema):
    slug: Slug
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: str | None = Field(None, max_length=10000)
    thumbnail: str | None = Field(None, max_length=255)
    category: Category = Category.ARCADE
    version: str = Field("1.0.0", min_length=1, max_length=20)
    config: dict[str, JsonValue] | None = None

    @field_validator("config")
    @classmethod
    def validate_config(cls, value: dict[str, JsonValue] | None) -> dict[str, JsonValue] | None:
        return validate_json_size(value, 100 * 1024) if value is not None else None


class GameResponse(ResponseSchema):
    id: int
    slug: str
    title: str
    description: str | None = None
    thumbnail: str | None = None
    category: Category
    version: str
    config: dict[str, JsonValue] | None = None
    is_active: bool
    created_at: datetime


class GameListResponse(ResponseSchema):
    games: list[GameResponse]
    total: int
