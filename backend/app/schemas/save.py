"""
Save Schemas
"""
import json
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, field_validator


# Maximum sizes to prevent database bloat
MAX_SAVE_DATA_SIZE = 1024 * 100  # 100KB max for save data JSON
MAX_THUMBNAIL_SIZE = 1024 * 500  # 500KB max for base64 thumbnail


class SaveCreate(BaseModel):
    """Schema for creating a game save."""
    slot: int = Field(..., ge=1, le=5)
    name: str | None = Field(None, max_length=100)
    data: dict = Field(...)
    thumbnail: str | None = Field(None, max_length=MAX_THUMBNAIL_SIZE)
    
    @field_validator('data')
    @classmethod
    def validate_data_size(cls, v: dict) -> dict:
        """Ensure save data doesn't exceed size limit."""
        json_str = json.dumps(v)
        if len(json_str) > MAX_SAVE_DATA_SIZE:
            raise ValueError(f'Save data exceeds maximum size of {MAX_SAVE_DATA_SIZE // 1024}KB')
        return v


class SaveUpdate(BaseModel):
    """Schema for updating a game save."""
    name: str | None = Field(None, max_length=100)
    data: dict = Field(...)
    thumbnail: str | None = Field(None, max_length=MAX_THUMBNAIL_SIZE)
    
    @field_validator('data')
    @classmethod
    def validate_data_size(cls, v: dict) -> dict:
        """Ensure save data doesn't exceed size limit."""
        json_str = json.dumps(v)
        if len(json_str) > MAX_SAVE_DATA_SIZE:
            raise ValueError(f'Save data exceeds maximum size of {MAX_SAVE_DATA_SIZE // 1024}KB')
        return v


class SaveResponse(BaseModel):
    """Schema for save data in responses."""
    id: int
    game_slug: str
    slot: int
    name: str | None = None
    data: dict
    thumbnail: str | None = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SaveListResponse(BaseModel):
    """Schema for list of saves."""
    saves: list[SaveResponse]
    total: int
