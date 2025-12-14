"""
Achievements Router
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.game import Game
from app.models.achievement import Achievement, AchievementUnlocked
from app.schemas.achievement import AchievementResponse, AchievementUnlock, AchievementListResponse
from app.utils.local_user import get_default_user

router = APIRouter()


@router.get("", response_model=AchievementListResponse)
async def get_all_achievements(
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get all achievements with unlock status."""
    # Get all achievements with their games
    result = await db.execute(
        select(Achievement).options(selectinload(Achievement.game))
    )
    all_achievements = result.scalars().all()
    
    # Get user's unlocked achievements
    unlocked_result = await db.execute(
        select(AchievementUnlocked.achievement_id, AchievementUnlocked.unlocked_at)
        .where(AchievementUnlocked.user_id == current_user.id)
    )
    unlocked_map = {row[0]: row[1] for row in unlocked_result.all()}
    
    achievements = [
        AchievementResponse(
            id=a.id,
            game_slug=a.game.slug,
            slug=a.slug,
            title=a.title,
            description=a.description,
            icon=a.icon,
            unlocked=a.id in unlocked_map,
            unlocked_at=unlocked_map.get(a.id)
        )
        for a in all_achievements
    ]
    
    return AchievementListResponse(
        achievements=achievements,
        total=len(achievements),
        unlocked_count=len(unlocked_map)
    )


@router.get("/{game_slug}", response_model=AchievementListResponse)
async def get_game_achievements(
    game_slug: str,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get achievements for a specific game."""
    # Get game
    game_result = await db.execute(
        select(Game).where(Game.slug == game_slug)
    )
    game = game_result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    # Get game achievements
    result = await db.execute(
        select(Achievement).where(Achievement.game_id == game.id)
    )
    game_achievements = result.scalars().all()
    
    # Get user's unlocked achievements for this game
    achievement_ids = [a.id for a in game_achievements]
    unlocked_result = await db.execute(
        select(AchievementUnlocked.achievement_id, AchievementUnlocked.unlocked_at)
        .where(
            AchievementUnlocked.user_id == current_user.id,
            AchievementUnlocked.achievement_id.in_(achievement_ids)
        )
    )
    unlocked_map = {row[0]: row[1] for row in unlocked_result.all()}
    
    achievements = [
        AchievementResponse(
            id=a.id,
            game_slug=game_slug,
            slug=a.slug,
            title=a.title,
            description=a.description,
            icon=a.icon,
            unlocked=a.id in unlocked_map,
            unlocked_at=unlocked_map.get(a.id)
        )
        for a in game_achievements
    ]
    
    return AchievementListResponse(
        achievements=achievements,
        total=len(achievements),
        unlocked_count=len(unlocked_map)
    )


@router.post("/unlock", status_code=status.HTTP_200_OK)
async def unlock_achievement(
    unlock_data: AchievementUnlock,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Unlock an achievement."""
    # Get game
    game_result = await db.execute(
        select(Game).where(Game.slug == unlock_data.game_slug)
    )
    game = game_result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    # Get achievement
    achievement_result = await db.execute(
        select(Achievement).where(
            Achievement.game_id == game.id,
            Achievement.slug == unlock_data.achievement_slug
        )
    )
    achievement = achievement_result.scalar_one_or_none()
    
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found"
        )
    
    # Check if already unlocked
    existing_result = await db.execute(
        select(AchievementUnlocked).where(
            AchievementUnlocked.user_id == current_user.id,
            AchievementUnlocked.achievement_id == achievement.id
        )
    )
    if existing_result.scalar_one_or_none():
        return {"message": "Achievement already unlocked", "unlocked": True}
    
    # Unlock achievement
    unlock = AchievementUnlocked(
        user_id=current_user.id,
        achievement_id=achievement.id,
        unlocked_at=datetime.now(timezone.utc)
    )
    db.add(unlock)
    await db.commit()
    
    return {
        "message": "Achievement unlocked!",
        "unlocked": True,
        "achievement": {
            "title": achievement.title,
            "description": achievement.description
        }
    }
