"""
Games Router - Game Store
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.game import Game, Category
from app.schemas.game import GameResponse, GameListResponse, GameCreate

router = APIRouter()


def escape_like_pattern(pattern: str) -> str:
    """Escape SQL LIKE special characters to prevent DoS via expensive patterns."""
    # Escape %, _, and \ which have special meaning in LIKE
    pattern = pattern.replace('\\', '\\\\')
    pattern = pattern.replace('%', '\\%')
    pattern = pattern.replace('_', '\\_')
    return pattern


@router.get("", response_model=GameListResponse)
async def list_games(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: Category | None = None,
    search: str | None = Query(None, max_length=100),  # Limit search length
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """List all available games in the store."""
    query = select(Game).where(Game.is_active == True)
    
    if category:
        query = query.where(Game.category == category)
    
    if search:
        # Sanitize search input to prevent LIKE pattern DoS
        safe_search = escape_like_pattern(search.strip())
        query = query.where(Game.title.ilike(f"%{safe_search}%"))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Game.title)
    result = await db.execute(query)
    games = result.scalars().all()
    
    return GameListResponse(
        games=[GameResponse.model_validate(g) for g in games],
        total=total
    )


@router.get("/categories")
async def list_categories():
    """List all game categories."""
    return [{"value": c.value, "label": c.value.title()} for c in Category]


@router.get("/{slug}", response_model=GameResponse)
async def get_game(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Get a specific game by slug."""
    result = await db.execute(
        select(Game).where(Game.slug == slug, Game.is_active == True)
    )
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    
    return GameResponse.model_validate(game)


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    game_data: GameCreate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Create a new game (for seeding/admin use)."""
    # Check if slug exists
    result = await db.execute(
        select(Game).where(Game.slug == game_data.slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game with this slug already exists"
        )
    
    game = Game(**game_data.model_dump())
    db.add(game)
    await db.commit()
    await db.refresh(game)
    
    return GameResponse.model_validate(game)
