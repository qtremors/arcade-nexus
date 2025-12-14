"""
Local User Utilities - Multi-profile local system
"""
from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User


async def get_or_create_default_user(db: AsyncSession) -> User:
    """Get active profile or create a default one if none exists."""
    # First try to find the active profile
    result = await db.execute(
        select(User).where(User.is_default == True, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if user:
        return user
    
    # Check if any profiles exist
    all_result = await db.execute(
        select(User).where(User.is_active == True).limit(1)
    )
    existing = all_result.scalar_one_or_none()
    
    if existing:
        # Make the first available profile the default
        existing.is_default = True
        await db.commit()
        await db.refresh(existing)
        return existing
    
    # No profiles exist - create a default one
    user = User(
        username="Player",
        is_active=True,
        is_default=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


async def get_default_user(
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """FastAPI dependency to get the current active profile."""
    return await get_or_create_default_user(db)
