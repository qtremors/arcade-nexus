"""Resolve a local profile explicitly, or use the selected profile for older clients."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User


async def get_active_profile(db: AsyncSession) -> User | None:
    return await db.scalar(select(User).where(User.is_default.is_(True), User.is_active.is_(True)))


async def get_default_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    profile_id: Annotated[int | None, Header(alias="X-Profile-ID", ge=1)] = None,
) -> User:
    if profile_id is not None:
        profile = await db.scalar(
            select(User).where(User.id == profile_id, User.is_active.is_(True))
        )
        if profile is None:
            raise HTTPException(404, "Profile not found")
        return profile
    profile = await get_active_profile(db)
    if profile is None:
        raise HTTPException(409, "Create or select a profile before using player data")
    return profile
