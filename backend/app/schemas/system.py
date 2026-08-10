from typing import Literal

from app.schemas.base import ResponseSchema


class HealthResponse(ResponseSchema):
    status: Literal["healthy", "unhealthy"]


class RootResponse(ResponseSchema):
    name: str
    version: str
    status: Literal["running"]
