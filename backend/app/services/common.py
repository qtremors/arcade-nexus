"""Catalog lookup and race-safe statistics creation."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.models.stats import PlayStats


async def get_game(slug: str, db: AsyncSession, *, include_inactive: bool = False) -> Game:
    query = select(Game).where(Game.slug == slug)
    if not include_inactive:
        query = query.where(Game.is_active.is_(True))
    game = await db.scalar(query)
    if game is None:
        raise HTTPException(404, "Game not found")
    return game


async def ensure_stats(user_id: int, game_id: int, db: AsyncSession) -> PlayStats:
    await db.execute(
        insert(PlayStats)
        .values(user_id=user_id, game_id=game_id)
        .on_conflict_do_nothing(index_elements=["user_id", "game_id"])
    )
    result = await db.execute(
        select(PlayStats)
        .where(PlayStats.user_id == user_id, PlayStats.game_id == game_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()
