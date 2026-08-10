"""
Library Schemas
"""

from datetime import datetime

from app.schemas.base import ResponseSchema
from app.schemas.game import GameResponse


class LibraryEntryResponse(ResponseSchema):
    """Schema for a library entry."""

    id: int
    game: GameResponse
    added_at: datetime
    last_played: datetime | None = None


class LibraryAddResponse(ResponseSchema):
    """Schema for add to library response."""

    message: str
    entry: LibraryEntryResponse
