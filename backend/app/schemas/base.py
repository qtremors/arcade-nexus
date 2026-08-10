"""Shared request validation and ORM response configuration."""

import json
from typing import Annotated

from pydantic import BaseModel, ConfigDict, JsonValue, StringConstraints

Slug = Annotated[
    str, StringConstraints(min_length=2, max_length=50, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
]


class RequestSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def validate_json_size(value: dict[str, JsonValue], maximum: int) -> dict[str, JsonValue]:
    try:
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError) as error:
        raise ValueError("Data must contain finite, valid JSON values") from error
    if len(encoded) > maximum:
        raise ValueError(f"JSON data exceeds the {maximum // 1024}KB limit")
    return value
