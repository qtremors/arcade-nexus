"""
Library Router - User's Game Library
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
from app.models.library import UserLibrary
from app.schemas.library import LibraryEntryResponse, LibraryAddResponse
from app.schemas.game import GameResponse
from app.utils.local_user import get_default_user

router = APIRouter()


@router.get("", response_model=list[LibraryEntryResponse])
async def get_library(
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get user's game library."""
    result = await db.execute(
        select(UserLibrary)
        .where(UserLibrary.user_id == current_user.id)
        .options(selectinload(UserLibrary.game))
        .order_by(UserLibrary.last_played.desc().nullsfirst(), UserLibrary.added_at.desc())
    )
    entries = result.scalars().all()
    
    return [
        LibraryEntryResponse(
            id=entry.id,
            game=GameResponse.model_validate(entry.game),
            added_at=entry.added_at,
            last_played=entry.last_played
        )
        for entry in entries
    ]


@router.post("/{game_id}", response_model=LibraryAddResponse, status_code=status.HTTP_201_CREATED)
async def add_to_library(
    game_id: int,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Add a game to user's library."""
    # Check if game exists
    game_result = await db.execute(
        select(Game).where(Game.id == game_id, Game.is_active == True)
    )
    game = game_result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    # Check if already in library
    existing_result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.game_id == game_id
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game already in library"
        )
    
    # Add to library
    entry = UserLibrary(
        user_id=current_user.id,
        game_id=game_id,
        added_at=datetime.now(timezone.utc)
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    
    # Load game relationship
    await db.refresh(entry, ["game"])
    
    return LibraryAddResponse(
        message="Game added to library",
        entry=LibraryEntryResponse(
            id=entry.id,
            game=GameResponse.model_validate(entry.game),
            added_at=entry.added_at,
            last_played=entry.last_played
        )
    )


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(
    game_id: int,
    current_user: Annotated[User, Depends(get_default_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Remove a game from user's library."""
    result = await db.execute(
        select(UserLibrary).where(
            UserLibrary.user_id == current_user.id,
            UserLibrary.game_id == game_id
        )
    )
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not in library"
        )
    
    await db.delete(entry)
    await db.commit()
