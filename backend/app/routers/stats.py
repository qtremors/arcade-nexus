"""Atomic statistics and durable, optionally idempotent session tracking."""

from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import selectinload

from app.datetime_utils import utc_now
from app.dependencies import CurrentUser, DbSession
from app.models.library import UserLibrary
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
from app.services.common import ensure_stats, get_game

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
    query = select(GameSession).where(
        GameSession.user_id == current_user.id, GameSession.end_time.is_not(None)
    )
    if game_id is not None:
        query = query.where(GameSession.game_id == game_id)
    sessions = (
        await db.scalars(
            query.order_by(GameSession.end_time.desc(), GameSession.id.desc())
            .offset(skip)
            .limit(limit)
            .options(selectinload(GameSession.game))
        )
    ).all()
    return [
        SessionResponse(
            metrics=session.metrics,
            id=session.id,
            session_id=session.session_id,
            game_slug=session.game.slug,
            game_title=session.game.title,
            start_time=session.start_time,
            end_time=session.end_time,
            duration_seconds=session.duration_seconds,
            score=session.score,
            difficulty=session.difficulty,
        )
        for session in sessions
    ]


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
    game = await get_game(game_slug, db)
    stats = await ensure_stats(current_user.id, game.id, db)
    session_id = str(
        session_data.session_id if session_data and session_data.session_id else uuid4()
    )
    result = await db.execute(
        insert(GameSession)
        .values(session_id=session_id, user_id=current_user.id, game_id=game.id, end_time=None)
        .on_conflict_do_nothing(index_elements=["session_id"])
        .returning(GameSession.id)
    )
    if result.scalar_one_or_none() is None:
        previous = await db.scalar(select(GameSession).where(GameSession.session_id == session_id))
        if previous.user_id != current_user.id or previous.game_id != game.id:
            raise HTTPException(409, "Session identity is already in use")
    else:
        now = utc_now()
        await db.execute(
            update(PlayStats)
            .where(PlayStats.id == stats.id)
            .values(sessions_count=PlayStats.sessions_count + 1, last_session=now)
        )
        await db.execute(
            update(UserLibrary)
            .where(UserLibrary.user_id == current_user.id, UserLibrary.game_id == game.id)
            .values(last_played=now)
        )
    await db.commit()
    await db.refresh(stats)
    return SessionStartResponse(
        message="Session started",
        sessions_count=stats.sessions_count,
        session_id=session_id,
        profile_id=current_user.id,
    )


def same_completion(session: GameSession, data: SessionRecord) -> bool:
    return (
        session.duration_seconds == data.playtime_seconds
        and session.score == data.score
        and session.difficulty == data.difficulty
        and (session.metrics or {}) == data.metrics.model_dump(exclude_none=True)
    )


@router.post("/{game_slug}/session", response_model=SessionRecordResponse)
async def record_session(
    game_slug: str,
    session_data: SessionRecord,
    current_user: CurrentUser,
    db: DbSession,
):
    game = await get_game(game_slug, db, include_inactive=True)
    # The upsert reserves SQLite's writer before reading or finishing the session.
    stats = await ensure_stats(current_user.id, game.id, db)
    query = select(GameSession).where(
        GameSession.user_id == current_user.id, GameSession.game_id == game.id
    )
    if session_data.session_id is not None:
        session = await db.scalar(
            query.where(GameSession.session_id == str(session_data.session_id))
        )
        if session is None:
            raise HTTPException(404, "Session not found for this profile and game")
    else:
        # Compatibility for the current frontend, which does not send session IDs.
        session = await db.scalar(
            query.where(GameSession.end_time.is_(None))
            .order_by(GameSession.start_time.desc(), GameSession.id.desc())
            .limit(1)
        )
    if session is not None and session.end_time is not None:
        if not same_completion(session, session_data):
            raise HTTPException(409, "A completed session cannot be changed")
        await db.commit()
        return SessionRecordResponse(
            message="Playtime recorded",
            total_playtime=stats.total_playtime_seconds,
            session_id=session.session_id,
        )

    now = utc_now()
    if session is None:
        if not game.is_active:
            raise HTTPException(404, "Game not found")
        session = GameSession(
            session_id=str(uuid4()),
            user_id=current_user.id,
            game_id=game.id,
            start_time=now - timedelta(seconds=session_data.playtime_seconds),
        )
        db.add(session)
    session.end_time = now
    session.duration_seconds = session_data.playtime_seconds
    session.score = session_data.score
    session.difficulty = session_data.difficulty
    session.metrics = session_data.metrics.model_dump(exclude_none=True)
    await db.execute(
        update(PlayStats)
        .where(PlayStats.id == stats.id)
        .values(
            total_playtime_seconds=PlayStats.total_playtime_seconds + session_data.playtime_seconds,
            last_session=now,
        )
    )
    # Preserve submitScore's "new high score" behavior used by the current frontend.
    await db.commit()
    await db.refresh(stats)
    return SessionRecordResponse(
        message="Playtime recorded",
        total_playtime=stats.total_playtime_seconds,
        session_id=session.session_id,
    )


@router.post("/{game_slug}/score", response_model=ScoreResponse)
async def submit_score(
    game_slug: str, score_data: ScoreSubmit, current_user: CurrentUser, db: DbSession
):
    game = await get_game(game_slug, db)
    stats = await ensure_stats(current_user.id, game.id, db)
    result = await db.execute(
        update(PlayStats)
        .where(PlayStats.id == stats.id, PlayStats.high_score < score_data.score)
        .values(high_score=score_data.score)
        .returning(PlayStats.high_score)
    )
    is_new_high = result.scalar_one_or_none() is not None
    await db.commit()
    await db.refresh(stats)
    return ScoreResponse(
        message="Score submitted",
        is_new_high_score=is_new_high,
        high_score=stats.high_score,
    )
