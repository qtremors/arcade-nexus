"""
Library Schemas
"""
from datetime import datetime
from pydantic import BaseModel
from app.schemas.game import GameResponse


class LibraryEntryResponse(BaseModel):
    """Schema for a library entry."""
    id: int
    game: GameResponse
    added_at: datetime
    last_played: datetime | None = None
    
    class Config:
        from_attributes = True


class LibraryAddResponse(BaseModel):
    """Schema for add to library response."""
    message: str
    entry: LibraryEntryResponse
