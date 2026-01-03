"""
Profiles Router - Local Profile Management
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import ProfileCreate, ProfileUpdate, ProfileResponse, ProfileListResponse

router = APIRouter()


async def get_active_profile(db: AsyncSession) -> User | None:
    """Get the currently active profile."""
    result = await db.execute(
        select(User).where(User.is_default == True, User.is_active == True)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=ProfileListResponse)
async def list_profiles(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """List all profiles."""
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.created_at)
    )
    profiles = result.scalars().all()
    
    active = next((p for p in profiles if p.is_default), None)
    
    return ProfileListResponse(
        profiles=[ProfileResponse.model_validate(p) for p in profiles],
        active_id=active.id if active else None
    )


@router.get("/active", response_model=ProfileResponse | None)
async def get_active(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get the currently active profile."""
    profile = await get_active_profile(db)
    if not profile:
        return None
    return ProfileResponse.model_validate(profile)


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    profile_data: ProfileCreate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Create a new profile."""
    # Check if username exists
    result = await db.execute(
        select(User).where(User.username == profile_data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if this is the first profile (make it default)
    count_result = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    is_first = count_result.scalar() == 0
    
    profile = User(
        username=profile_data.username,
        avatar=profile_data.avatar,
        is_default=is_first,  # First profile is automatically active
        last_login=datetime.now(timezone.utc) if is_first else None
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    
    return ProfileResponse.model_validate(profile)


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: int,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get a specific profile."""
    result = await db.execute(
        select(User).where(User.id == profile_id, User.is_active == True)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    return ProfileResponse.model_validate(profile)


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: int,
    profile_data: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Update a profile."""
    result = await db.execute(
        select(User).where(User.id == profile_id, User.is_active == True)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Check username uniqueness if changing
    if profile_data.username and profile_data.username != profile.username:
        existing = await db.execute(
            select(User).where(User.username == profile_data.username)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        profile.username = profile_data.username
    
    if profile_data.avatar is not None:
        profile.avatar = profile_data.avatar
    
    await db.commit()
    await db.refresh(profile)
    
    return ProfileResponse.model_validate(profile)


@router.post("/{profile_id}/activate", response_model=ProfileResponse)
async def activate_profile(
    profile_id: int,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Switch to a different profile."""
    # Get target profile
    result = await db.execute(
        select(User).where(User.id == profile_id, User.is_active == True)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Deactivate all other profiles
    await db.execute(
        update(User)
        .where(User.is_active == True)
        .values(is_default=False)
    )
    
    # Activate this profile
    profile.is_default = True
    profile.last_login = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(profile)
    
    return ProfileResponse.model_validate(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: int,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Delete a profile (soft delete - marks inactive)."""
    result = await db.execute(
        select(User).where(User.id == profile_id, User.is_active == True)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    was_default = profile.is_default
    profile.is_active = False
    profile.is_default = False
    
    # If this was the default profile, make another one default
    if was_default:
        other_result = await db.execute(
            select(User).where(User.is_active == True, User.id != profile_id).limit(1)
        )
        other = other_result.scalar_one_or_none()
        if other:
            other.is_default = True
    
    await db.commit()
