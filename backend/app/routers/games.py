"""Installed game catalog and opt-in development metadata creation."""

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert

from app.dependencies import DbSession
from app.models.game import Category, Game
from app.schemas.game import GameCreate, GameListResponse, GameResponse
from app.services.common import get_game as find_game

router = APIRouter()


def escape_like_pattern(pattern: str) -> str:
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=GameListResponse)
async def list_games(
    db: DbSession,
    category: Category | None = None,
    search: str | None = Query(None, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    query = select(Game).where(Game.is_active.is_(True))
    if category:
        query = query.where(Game.category == category)
    if search and search.strip():
        query = query.where(
            Game.title.ilike(f"%{escape_like_pattern(search.strip())}%", escape="\\")
        )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    games = (await db.scalars(query.order_by(Game.title, Game.id).offset(skip).limit(limit))).all()
    return GameListResponse(games=games, total=total)


@router.get("/categories")
async def list_categories() -> list[dict[str, str]]:
    return [{"value": category.value, "label": category.value.title()} for category in Category]


@router.get("/{slug}", response_model=GameResponse)
async def get_game(slug: str, db: DbSession):
    return await find_game(slug, db)


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(game_data: GameCreate, request: Request, db: DbSession):
    if not request.app.state.settings.ALLOW_GAME_CREATION:
        raise HTTPException(
            403, "Game creation is disabled; install games through the bundled catalog"
        )
    result = await db.execute(
        insert(Game)
        .values(**game_data.model_dump())
        .on_conflict_do_nothing(index_elements=["slug"])
        .returning(Game.id)
    )
    game_id = result.scalar_one_or_none()
    if game_id is None:
        raise HTTPException(400, "Game with this slug already exists")
    await db.commit()
    return await db.get(Game, game_id)
