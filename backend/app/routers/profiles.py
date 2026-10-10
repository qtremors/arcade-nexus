"""Local profile management with serialized selection changes."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, text, update

from app.datetime_utils import utc_now
from app.dependencies import DbSession
from app.models.user import User
from app.schemas.user import (
    ProfileCreate,
    ProfileListResponse,
    ProfileResponse,
    ProfileUpdate,
)
from app.utils.local_user import get_active_profile

router = APIRouter()


async def find_profile(profile_id: int, db: DbSession) -> User:
    profile = await db.scalar(select(User).where(User.id == profile_id, User.is_active.is_(True)))
    if profile is None:
        raise HTTPException(404, "Profile not found")
    return profile


@router.get("", response_model=ProfileListResponse)
async def list_profiles(db: DbSession):
    profiles = (
        await db.scalars(
            select(User).where(User.is_active.is_(True)).order_by(User.created_at, User.id)
        )
    ).all()
    active = next((profile for profile in profiles if profile.is_default), None)
    return ProfileListResponse(
        profiles=[ProfileResponse.model_validate(profile) for profile in profiles],
        active_id=active.id if active else None,
    )


@router.get("/active", response_model=ProfileResponse | None)
async def get_active(db: DbSession):
    return await get_active_profile(db)


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(profile_data: ProfileCreate, db: DbSession):
    # Acquire SQLite's writer reservation before deciding which profile is selected.
    await db.execute(text("BEGIN IMMEDIATE"))
    if await db.scalar(select(User.id).where(User.username == profile_data.username)):
        raise HTTPException(400, "Username already exists")
    selected = await get_active_profile(db)
    first = selected is None
    profile = User(
        username=profile_data.username,
        avatar=profile_data.avatar,
        is_default=first,
        last_login=utc_now() if first else None,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(profile_id: int, db: DbSession):
    return await find_profile(profile_id, db)


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(profile_id: int, profile_data: ProfileUpdate, db: DbSession):
    await db.execute(text("BEGIN IMMEDIATE"))
    profile = await find_profile(profile_id, db)
    if profile_data.username is not None and profile_data.username != profile.username:
        if await db.scalar(select(User.id).where(User.username == profile_data.username)):
            raise HTTPException(400, "Username already exists")
        profile.username = profile_data.username
    if "avatar" in profile_data.model_fields_set:
        profile.avatar = profile_data.avatar
    await db.commit()
    await db.refresh(profile)
    return profile


@router.post("/{profile_id}/activate", response_model=ProfileResponse)
async def activate_profile(profile_id: int, db: DbSession):
    await db.execute(text("BEGIN IMMEDIATE"))
    profile = await find_profile(profile_id, db)
    await db.execute(update(User).values(is_default=False))
    profile.is_default = True
    profile.last_login = utc_now()
    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(profile_id: int, db: DbSession):
    await db.execute(text("BEGIN IMMEDIATE"))
    profile = await find_profile(profile_id, db)
    was_selected = profile.is_default
    profile.is_active = False
    profile.is_default = False
    # Release the partial unique index before selecting the replacement.
    await db.flush()
    if was_selected:
        other = await db.scalar(
            select(User)
            .where(User.is_active.is_(True), User.id != profile_id)
            .order_by(User.created_at, User.id)
            .limit(1)
        )
        if other:
            other.is_default = True
            other.last_login = utc_now()
    await db.commit()
