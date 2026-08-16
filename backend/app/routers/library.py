"""Profile-scoped library membership; removal preserves saves and statistics."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DbSession
from app.models.game import Game
from app.models.library import UserLibrary
from app.schemas.library import LibraryAddResponse, LibraryEntryResponse

router = APIRouter()


@router.get("", response_model=list[LibraryEntryResponse])
async def get_library(
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
):
    query = (
        select(UserLibrary)
        .join(Game)
        .where(UserLibrary.user_id == current_user.id, Game.is_active.is_(True))
        .options(selectinload(UserLibrary.game))
        .order_by(
            UserLibrary.last_played.desc().nullslast(),
            UserLibrary.added_at.desc(),
            UserLibrary.id.desc(),
        )
        .offset(skip)
    )
    if limit is not None:
        query = query.limit(limit)
    return (await db.scalars(query)).all()


@router.post("/{game_id}", response_model=LibraryAddResponse, status_code=status.HTTP_201_CREATED)
async def add_to_library(game_id: int, current_user: CurrentUser, db: DbSession):
    game = await db.scalar(select(Game).where(Game.id == game_id, Game.is_active.is_(True)))
    if game is None:
        raise HTTPException(404, "Game not found")
    result = await db.execute(
        insert(UserLibrary)
        .values(user_id=current_user.id, game_id=game.id)
        .on_conflict_do_nothing(index_elements=["user_id", "game_id"])
        .returning(UserLibrary.id)
    )
    entry_id = result.scalar_one_or_none()
    if entry_id is None:
        raise HTTPException(400, "Game already in library")
    await db.commit()
    entry = await db.scalar(
        select(UserLibrary)
        .where(UserLibrary.id == entry_id)
        .options(selectinload(UserLibrary.game))
    )
    return LibraryAddResponse(message="Game added to library", entry=entry)


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(game_id: int, current_user: CurrentUser, db: DbSession):
    entry = await db.scalar(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id, UserLibrary.game_id == game_id
        )
    )
    if entry is None:
        raise HTTPException(404, "Game not in library")
    await db.delete(entry)
    await db.commit()
