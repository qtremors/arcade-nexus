"""Legacy start/playtime/score transactions; kept separate from atomic award receipts."""

from datetime import timedelta
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.datetime_utils import utc_now
from app.models.library import UserLibrary
from app.models.session import GameSession
from app.models.stats import PlayStats
from app.schemas.stats import (
    ScoreResponse,
    ScoreSubmit,
    SessionRecord,
    SessionRecordResponse,
    SessionStart,
    SessionStartResponse,
)
from app.services.common import ensure_stats, get_game
from app.services.errors import ServiceError
from app.services.session_policy import same_completion


async def start_session(
    game_slug: str,
    user_id: int,
    db: AsyncSession,
    session_data: SessionStart | None = None,
):
    game = await get_game(game_slug, db)
    stats = await ensure_stats(user_id, game.id, db)
    session_id = str(
        session_data.session_id if session_data and session_data.session_id else uuid4()
    )
    result = await db.execute(
        insert(GameSession)
        .values(session_id=session_id, user_id=user_id, game_id=game.id, end_time=None)
        .on_conflict_do_nothing(index_elements=["session_id"])
        .returning(GameSession.id)
    )
    if result.scalar_one_or_none() is None:
        previous = await db.scalar(select(GameSession).where(GameSession.session_id == session_id))
        if previous.user_id != user_id or previous.game_id != game.id:
            raise ServiceError(409, "Session identity is already in use")
    else:
        now = utc_now()
        await db.execute(
            update(PlayStats)
            .where(PlayStats.id == stats.id)
            .values(sessions_count=PlayStats.sessions_count + 1, last_session=now)
        )
        await db.execute(
            update(UserLibrary)
            .where(UserLibrary.user_id == user_id, UserLibrary.game_id == game.id)
            .values(last_played=now)
        )
    await db.commit()
    await db.refresh(stats)
    return SessionStartResponse(
        message="Session started",
        sessions_count=stats.sessions_count,
        session_id=session_id,
        profile_id=user_id,
    )


async def record_session(
    game_slug: str,
    session_data: SessionRecord,
    user_id: int,
    db: AsyncSession,
):
    game = await get_game(game_slug, db, include_inactive=True)
    # The upsert reserves SQLite's writer before reading or finishing the session.
    stats = await ensure_stats(user_id, game.id, db)
    query = select(GameSession).where(
        GameSession.user_id == user_id, GameSession.game_id == game.id
    )
    if session_data.session_id is not None:
        session = await db.scalar(
            query.where(GameSession.session_id == str(session_data.session_id))
        )
        if session is None:
            raise ServiceError(404, "Session not found for this profile and game")
    else:
        # Legacy clients may omit a session UUID.
        session = await db.scalar(
            query.where(GameSession.end_time.is_(None))
            .order_by(GameSession.start_time.desc(), GameSession.id.desc())
            .limit(1)
        )
    if session is not None and session.end_time is not None:
        if not same_completion(session, session_data):
            raise ServiceError(409, "A completed session cannot be changed")
        await db.commit()
        return SessionRecordResponse(
            message="Playtime recorded",
            total_playtime=stats.total_playtime_seconds,
            session_id=session.session_id,
        )

    now = utc_now()
    created = session is None
    if created:
        if not game.is_active:
            raise ServiceError(404, "Game not found")
        session = GameSession(
            session_id=str(uuid4()),
            user_id=user_id,
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
            sessions_count=PlayStats.sessions_count + int(created),
            last_session=now,
        )
    )
    # Legacy score submission is intentionally separate from playtime completion.
    await db.commit()
    await db.refresh(stats)
    return SessionRecordResponse(
        message="Playtime recorded",
        total_playtime=stats.total_playtime_seconds,
        session_id=session.session_id,
    )


async def submit_score(game_slug: str, score_data: ScoreSubmit, user_id: int, db: AsyncSession):
    game = await get_game(game_slug, db)
    stats = await ensure_stats(user_id, game.id, db)
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
