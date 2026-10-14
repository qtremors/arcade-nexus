"""Achievement reads and condition checks against recorded gameplay."""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.dialects.sqlite import insert

from app.dependencies import CurrentUser, DbSession
from app.models.achievement import Achievement, AchievementUnlocked
from app.models.game import Game
from app.models.session import GameSession
from app.models.stats import PlayStats
from app.schemas.achievement import (
    AchievementListResponse,
    AchievementResponse,
    AchievementSummary,
    AchievementUnlock,
)
from app.services.common import get_game

router = APIRouter()


def achievement_query(user_id: int, game_id: int | None = None):
    query = (
        select(Achievement.id)
        .join(Game, Game.id == Achievement.game_id)
        .outerjoin(
            AchievementUnlocked,
            and_(
                AchievementUnlocked.achievement_id == Achievement.id,
                AchievementUnlocked.user_id == user_id,
            ),
        )
        .where(Game.is_active.is_(True))
    )
    if game_id is not None:
        query = query.where(Achievement.game_id == game_id)
    return query


async def achievement_totals(query, db: DbSession):
    total, unlocked = (
        await db.execute(
            query.with_only_columns(
                func.count(Achievement.id),
                func.count(AchievementUnlocked.id),
                maintain_column_froms=True,
            )
        )
    ).one()
    return {"total": total, "unlocked_count": unlocked}


async def achievement_list(
    user_id: int,
    db: DbSession,
    *,
    game_id: int | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> AchievementListResponse:
    query = achievement_query(user_id, game_id)
    totals = await achievement_totals(query, db)
    page = (
        query.with_only_columns(
            Achievement, Game.slug, AchievementUnlocked.unlocked_at, maintain_column_froms=True
        )
        .order_by(Achievement.game_id, Achievement.id)
        .offset(skip)
    )
    if limit is not None:
        page = page.limit(limit)
    achievements = (await db.execute(page)).all()
    return AchievementListResponse(
        achievements=[
            AchievementResponse(
                unlock_condition=item.unlock_condition,
                id=item.id,
                game_slug=slug,
                slug=item.slug,
                title=item.title,
                description=item.description,
                icon=item.icon,
                unlocked=unlocked_at is not None,
                unlocked_at=unlocked_at,
            )
            for item, slug, unlocked_at in achievements
        ],
        **totals,
    )


@router.get("", response_model=AchievementListResponse)
async def get_all_achievements(
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
):
    return await achievement_list(current_user.id, db, skip=skip, limit=limit)


@router.get("/summary", response_model=AchievementSummary)
async def get_achievement_summary(current_user: CurrentUser, db: DbSession):
    return await achievement_totals(achievement_query(current_user.id), db)


@router.get("/{game_slug}", response_model=AchievementListResponse)
async def get_game_achievements(
    game_slug: str,
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
):
    game = await get_game(game_slug, db)
    return await achievement_list(current_user.id, db, game_id=game.id, skip=skip, limit=limit)


@router.post("/unlock")
async def unlock_achievement(
    unlock_data: AchievementUnlock, current_user: CurrentUser, db: DbSession
):
    game = await get_game(unlock_data.game_slug, db)
    achievement = await db.scalar(
        select(Achievement).where(
            Achievement.game_id == game.id, Achievement.slug == unlock_data.achievement_slug
        )
    )
    if achievement is None:
        raise HTTPException(404, "Achievement not found")
    existing = await db.scalar(
        select(AchievementUnlocked.id).where(
            AchievementUnlocked.user_id == current_user.id,
            AchievementUnlocked.achievement_id == achievement.id,
        )
    )
    if existing:
        return {"message": "Achievement already unlocked", "unlocked": True}

    condition = achievement.unlock_condition or {}
    if set(condition) == {"score"}:
        required = condition["score"]
        if not isinstance(required, int) or isinstance(required, bool) or required < 0:
            raise HTTPException(409, "Achievement condition is invalid")
        high_score = (
            await db.scalar(
                select(PlayStats.high_score).where(
                    PlayStats.user_id == current_user.id, PlayStats.game_id == game.id
                )
            )
            or 0
        )
        recorded_score = (
            await db.scalar(
                select(func.max(GameSession.score)).where(
                    GameSession.user_id == current_user.id,
                    GameSession.game_id == game.id,
                    GameSession.end_time.is_not(None),
                )
            )
            or 0
        )
        qualified = max(high_score, recorded_score) >= required
    elif set(condition) in ({"jumps"}, {"max_altitude"}, {"flight_seconds"}):
        metric, required = next(iter(condition.items()))
        if not isinstance(required, int) or isinstance(required, bool) or required < 0:
            raise HTTPException(409, "Achievement condition is invalid")
        measurement = (
            (GameSession.duration_seconds >= required)
            & GameSession.metrics["crashed"].as_boolean().is_(False)
            if metric == "flight_seconds"
            else GameSession.metrics[metric].as_float() >= required
        )
        qualified = (
            await db.scalar(
                select(GameSession.id)
                .where(
                    GameSession.user_id == current_user.id,
                    GameSession.game_id == game.id,
                    GameSession.end_time.is_not(None),
                    measurement,
                )
                .limit(1)
            )
            is not None
        )
    else:
        raise HTTPException(409, "This achievement requires unsupported game events")
    if not qualified:
        raise HTTPException(409, "Achievement conditions have not been met")
    result = await db.execute(
        insert(AchievementUnlocked)
        .values(
            user_id=current_user.id,
            achievement_id=achievement.id,
        )
        .on_conflict_do_nothing(index_elements=["user_id", "achievement_id"])
        .returning(AchievementUnlocked.id)
    )
    created = result.scalar_one_or_none() is not None
    await db.commit()
    return {
        "message": "Achievement unlocked!" if created else "Achievement already unlocked",
        "unlocked": True,
        "achievement": {"title": achievement.title, "description": achievement.description},
    }
