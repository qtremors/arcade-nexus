"""Local profile requests and responses."""

import unicodedata
from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints, field_validator

from app.schemas.base import RequestSchema, ResponseSchema

Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class ProfileCreate(RequestSchema):
    username: Username
    avatar: str | None = Field(None, max_length=255)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if any(unicodedata.category(c) in {"Cc", "Cs"} for c in value):
            raise ValueError("Username cannot contain control characters")
        return value


class ProfileUpdate(RequestSchema):
    username: Username | None = None
    avatar: str | None = Field(None, max_length=255)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        return ProfileCreate.validate_username(value) if value is not None else None


class ProfileResponse(ResponseSchema):
    id: int
    username: str
    avatar: str | None = None
    is_default: bool = False
    created_at: datetime
    last_login: datetime | None = None


class ProfileListResponse(ResponseSchema):
    profiles: list[ProfileResponse]
    active_id: int | None = None
