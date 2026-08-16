"""Atomic statistics and durable, optionally idempotent session tracking."""


from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DbSession
from app.models.session import GameSession
from app.models.stats import PlayStats
from app.schemas.stats import (
    GameStatsResponse,
    ScoreResponse,
    ScoreSubmit,
    SessionRecord,
    SessionRecordResponse,
    SessionResponse,
    SessionStart,
    SessionStartResponse,
    StatsResponse,
)
from app.services import legacy_sessions
from app.services.common import get_game
from app.services.history import history_query, session_response

router = APIRouter()


def game_stats(stats: PlayStats) -> GameStatsResponse:
    return GameStatsResponse(
        game_slug=stats.game.slug,
        game_title=stats.game.title,
        total_playtime_seconds=stats.total_playtime_seconds,
        sessions_count=stats.sessions_count,
        high_score=stats.high_score,
        last_session=stats.last_session,
    )


@router.get("", response_model=StatsResponse)
async def get_overall_stats(current_user: CurrentUser, db: DbSession):
    stats = (
        await db.scalars(
            select(PlayStats)
            .where(PlayStats.user_id == current_user.id)
            .options(selectinload(PlayStats.game))
            .order_by(PlayStats.game_id)
        )
    ).all()
    # A single snapshot keeps totals consistent with the included game records.
    return StatsResponse(
        total_playtime_seconds=sum(item.total_playtime_seconds for item in stats),
        total_games_played=sum(item.sessions_count > 0 for item in stats),
        total_sessions=sum(item.sessions_count for item in stats),
        games=[game_stats(item) for item in stats],
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def get_session_history(
    current_user: CurrentUser,
    db: DbSession,
    game_id: int | None = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    query = history_query(current_user.id, game_id=game_id)
    sessions = (
        await db.scalars(query.offset(skip).limit(limit).options(selectinload(GameSession.game)))
    ).all()
    return [session_response(session) for session in sessions]


@router.get("/{game_slug}", response_model=GameStatsResponse)
async def get_game_stats(game_slug: str, current_user: CurrentUser, db: DbSession):
    game = await get_game(game_slug, db, include_inactive=True)
    stats = await db.scalar(
        select(PlayStats)
        .where(PlayStats.user_id == current_user.id, PlayStats.game_id == game.id)
        .options(selectinload(PlayStats.game))
    )
    if stats is not None:
        return game_stats(stats)
    return GameStatsResponse(
        game_slug=game.slug,
        game_title=game.title,
        total_playtime_seconds=0,
        sessions_count=0,
        high_score=0,
        last_session=None,
    )


@router.post("/{game_slug}/start", response_model=SessionStartResponse)
async def start_session(
    game_slug: str,
    current_user: CurrentUser,
    db: DbSession,
    session_data: SessionStart | None = None,
):
    return await legacy_sessions.start_session(game_slug,current_user.id,db,session_data)


@router.post("/{game_slug}/session", response_model=SessionRecordResponse)
async def record_session(
    game_slug: str,
    session_data: SessionRecord,
    current_user: CurrentUser,
    db: DbSession,
):
    return await legacy_sessions.record_session(game_slug,session_data,current_user.id,db)


@router.post("/{game_slug}/score", response_model=ScoreResponse)
async def submit_score(
    game_slug: str, score_data: ScoreSubmit, current_user: CurrentUser, db: DbSession
):
    return await legacy_sessions.submit_score(game_slug,score_data,current_user.id,db)
