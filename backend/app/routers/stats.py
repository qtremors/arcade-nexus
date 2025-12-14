"""
Stats Router - Play Statistics
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.game import Game
from app.models.stats import PlayStats
from app.models.library import UserLibrary
from app.schemas.stats import StatsResponse, GameStatsResponse, SessionRecord, ScoreSubmit
from app.utils.local_user import get_default_user

router = APIRouter()


async def get_or_create_stats(
    user_id: int,
    game_id: int,
    db: AsyncSession
) -> PlayStats:
    """Get existing stats or create new record."""
    result = await db.execute(
        select(PlayStats).where(
            PlayStats.user_id == user_id,
            PlayStats.game_id == game_id
        )
    )
    stats = result.scalar_one_or_none()
    
    if not stats:
        stats = PlayStats(
            user_id=user_id,
            game_id=game_id
        )
        db.add(stats)
        await db.flush()
    
    return stats


@router.get("", response_model=StatsResponse)
async def get_overall_stats(
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get overall user stats across all games."""
    result = await db.execute(
        select(PlayStats)
        .where(PlayStats.user_id == current_user.id)
        .options(selectinload(PlayStats.game))
    )
    all_stats = result.scalars().all()
    
    total_playtime = sum(s.total_playtime_seconds for s in all_stats)
    total_sessions = sum(s.sessions_count for s in all_stats)
    
    game_stats = [
        GameStatsResponse(
            game_slug=s.game.slug,
            game_title=s.game.title,
            total_playtime_seconds=s.total_playtime_seconds,
            sessions_count=s.sessions_count,
            high_score=s.high_score,
            last_session=s.last_session
        )
        for s in all_stats
    ]
    
    return StatsResponse(
        total_playtime_seconds=total_playtime,
        total_games_played=len(all_stats),
        total_sessions=total_sessions,
        games=game_stats
    )


@router.get("/{game_slug}", response_model=GameStatsResponse)
async def get_game_stats(
    game_slug: str,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get stats for a specific game."""
    result = await db.execute(
        select(Game).where(Game.slug == game_slug)
    )
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    stats_result = await db.execute(
        select(PlayStats).where(
            PlayStats.user_id == current_user.id,
            PlayStats.game_id == game.id
        )
    )
    stats = stats_result.scalar_one_or_none()
    
    if not stats:
        return GameStatsResponse(
            game_slug=game_slug,
            game_title=game.title,
            total_playtime_seconds=0,
            sessions_count=0,
            high_score=0,
            last_session=None
        )
    
    return GameStatsResponse(
        game_slug=game_slug,
        game_title=game.title,
        total_playtime_seconds=stats.total_playtime_seconds,
        sessions_count=stats.sessions_count,
        high_score=stats.high_score,
        last_session=stats.last_session
    )


@router.post("/{game_slug}/session")
async def record_session(
    game_slug: str,
    session_data: SessionRecord,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Record a play session (playtime)."""
    result = await db.execute(
        select(Game).where(Game.slug == game_slug)
    )
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    stats = await get_or_create_stats(current_user.id, game.id, db)
    stats.total_playtime_seconds += session_data.playtime_seconds
    stats.sessions_count += 1
    stats.last_session = datetime.now(timezone.utc)
    
    # Update last_played in library
    library_result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.game_id == game.id
        )
    )
    library_entry = library_result.scalar_one_or_none()
    if library_entry:
        library_entry.last_played = datetime.now(timezone.utc)
    
    await db.commit()
    
    return {"message": "Session recorded", "total_playtime": stats.total_playtime_seconds}


@router.post("/{game_slug}/score")
async def submit_score(
    game_slug: str,
    score_data: ScoreSubmit,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Submit a high score."""
    result = await db.execute(
        select(Game).where(Game.slug == game_slug)
    )
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    stats = await get_or_create_stats(current_user.id, game.id, db)
    
    is_new_high = score_data.score > stats.high_score
    if is_new_high:
        stats.high_score = score_data.score
    
    await db.commit()
    
    return {
        "message": "Score submitted",
        "is_new_high_score": is_new_high,
        "high_score": stats.high_score
    }
