"""
User/Profile Schemas
"""
from datetime import datetime
from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    """Schema for creating a new profile."""
    username: str = Field(..., min_length=1, max_length=50)
    avatar: str | None = None


class ProfileUpdate(BaseModel):
    """Schema for updating a profile."""
    username: str | None = Field(None, min_length=1, max_length=50)
    avatar: str | None = None


class ProfileResponse(BaseModel):
    """Schema for profile data in responses."""
    id: int
    username: str
    avatar: str | None = None
    is_default: bool = False
    created_at: datetime
    last_login: datetime | None = None
    
    class Config:
        from_attributes = True


class ProfileListResponse(BaseModel):
    """Schema for list of profiles."""
    profiles: list[ProfileResponse]
    active_id: int | None = None
