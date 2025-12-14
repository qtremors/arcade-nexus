"""
Saves Router - Game Save Management
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.game import Game
from app.models.save import GameSave
from app.schemas.save import SaveCreate, SaveUpdate, SaveResponse, SaveListResponse
from app.utils.local_user import get_default_user

router = APIRouter()


async def get_game_by_slug(slug: str, db: AsyncSession) -> Game:
    """Helper to get game by slug."""
    result = await db.execute(
        select(Game).where(Game.slug == slug, Game.is_active == True)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    return game


@router.get("/{game_slug}", response_model=SaveListResponse)
async def list_saves(
    game_slug: str,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """List all saves for a game."""
    game = await get_game_by_slug(game_slug, db)
    
    result = await db.execute(
        select(GameSave)
        .where(GameSave.user_id == current_user.id, GameSave.game_id == game.id)
        .order_by(GameSave.slot)
    )
    saves = result.scalars().all()
    
    return SaveListResponse(
        saves=[
            SaveResponse(
                id=s.id,
                game_slug=game_slug,
                slot=s.slot,
                name=s.name,
                data=s.data,
                thumbnail=s.thumbnail,
                created_at=s.created_at,
                updated_at=s.updated_at
            )
            for s in saves
        ],
        total=len(saves)
    )


@router.post("/{game_slug}", response_model=SaveResponse, status_code=status.HTTP_201_CREATED)
async def create_save(
    game_slug: str,
    save_data: SaveCreate,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Create a new save or update existing slot."""
    game = await get_game_by_slug(game_slug, db)
    
    # Check if slot exists
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.game_id == game.id,
            GameSave.slot == save_data.slot
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing save
        existing.name = save_data.name
        existing.data = save_data.data
        existing.thumbnail = save_data.thumbnail
        existing.updated_at = datetime.now(timezone.utc)
        save = existing
    else:
        # Create new save
        save = GameSave(
            user_id=current_user.id,
            game_id=game.id,
            slot=save_data.slot,
            name=save_data.name,
            data=save_data.data,
            thumbnail=save_data.thumbnail
        )
        db.add(save)
    
    await db.commit()
    await db.refresh(save)
    
    return SaveResponse(
        id=save.id,
        game_slug=game_slug,
        slot=save.slot,
        name=save.name,
        data=save.data,
        thumbnail=save.thumbnail,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.put("/{game_slug}/{slot}", response_model=SaveResponse)
async def update_save(
    game_slug: str,
    slot: int,
    save_data: SaveUpdate,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Update an existing save slot."""
    game = await get_game_by_slug(game_slug, db)
    
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.game_id == game.id,
            GameSave.slot == slot
        )
    )
    save = result.scalar_one_or_none()
    
    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )
    
    save.name = save_data.name
    save.data = save_data.data
    save.thumbnail = save_data.thumbnail
    save.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(save)
    
    return SaveResponse(
        id=save.id,
        game_slug=game_slug,
        slot=save.slot,
        name=save.name,
        data=save.data,
        thumbnail=save.thumbnail,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.delete("/{game_slug}/{slot}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_save(
    game_slug: str,
    slot: int,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Delete a save slot."""
    game = await get_game_by_slug(game_slug, db)
    
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.game_id == game.id,
            GameSave.slot == slot
        )
    )
    save = result.scalar_one_or_none()
    
    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )
    
    await db.delete(save)
    await db.commit()
