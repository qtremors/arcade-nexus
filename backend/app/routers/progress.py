"""One transaction per result, replayable receipts, recovery and household records."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.sqlite import insert

from app.datetime_utils import utc_now
from app.dependencies import CurrentUser, DbSession
from app.game_rules import time_ranked
from app.models import (
    Achievement,
    AchievementUnlocked,
    Game,
    GameRecord,
    GameSession,
    RecoverySave,
    User,
    UserLibrary,
)
from app.routers.stats import same_completion
from app.schemas.save import SaveUpdate
from app.schemas.stats import CompletionRecord
from app.services.common import ensure_stats, get_game

router = APIRouter()


@router.post("/{slug}/complete")
async def complete(slug: str, data: CompletionRecord, current_user: CurrentUser, db: DbSession):
    game = await get_game(slug, db, include_inactive=True)
    stats = await ensure_stats(current_user.id, game.id, db)
    session = await db.scalar(
        select(GameSession).where(GameSession.session_id == str(data.session_id))
    )
    payload = data.model_dump(mode="json")
    if session is not None:
        if session.user_id != current_user.id or session.game_id != game.id:
            raise HTTPException(409, "Session belongs to another player or game")
        if session.completion:
            if (
                CompletionRecord.model_validate(session.completion["payload"]).model_dump(
                    mode="json"
                )
                != payload
            ):
                raise HTTPException(409, "A completed session cannot be changed")
            return session.completion["result"]
        if session.end_time is not None and not same_completion(session, data):
            raise HTTPException(409, "A completed session cannot be changed")
    now = utc_now()
    if session is None:
        session = GameSession(
            session_id=str(data.session_id),
            user_id=current_user.id,
            game_id=game.id,
            start_time=now - timedelta(seconds=data.playtime_seconds),
        )
        db.add(session)
        stats.sessions_count += 1
    if session.end_time is None:
        stats.total_playtime_seconds += data.playtime_seconds
    session.end_time = session.end_time or now
    session.duration_seconds = data.playtime_seconds
    session.score = data.score
    session.difficulty = data.difficulty
    session.mode = data.mode
    session.rules_version = data.rules_version
    session.metrics = data.metrics.model_dump(exclude_none=True)
    stats.high_score = max(stats.high_score, data.score)
    stats.last_session = now
    key = dict(
        user_id=current_user.id,
        game_id=game.id,
        mode=data.mode,
        difficulty=data.difficulty or "normal",
        rules_version=data.rules_version,
    )
    await db.execute(insert(GameRecord).values(**key, high_score=0).on_conflict_do_nothing())
    record = await db.scalar(select(GameRecord).filter_by(**key))
    previous_high = record.high_score
    new_high = data.score > record.high_score
    best_time = previous_time = None
    new_time = False
    if time_ranked(slug, data.mode, data.rules_version):
        previous_time = await db.scalar(
            select(func.min(GameSession.metrics["elapsed_ms"].as_integer())).where(
                GameSession.user_id == current_user.id,
                GameSession.game_id == game.id,
                GameSession.mode == data.mode,
                func.coalesce(GameSession.difficulty, "normal") == (data.difficulty or "normal"),
                GameSession.rules_version == data.rules_version,
                GameSession.session_id != str(data.session_id),
                GameSession.end_time.is_not(None),
                GameSession.metrics["completed"].as_boolean().is_(True),
                GameSession.metrics["elapsed_ms"].as_integer() > 0,
            )
        )
        best_time = previous_time
        if data.metrics.completed and data.metrics.elapsed_ms:
            new_time = previous_time is None or data.metrics.elapsed_ms < previous_time
            best_time = min(previous_time or data.metrics.elapsed_ms, data.metrics.elapsed_ms)
    record.high_score = max(record.high_score, data.score)
    await db.execute(
        update(UserLibrary)
        .where(UserLibrary.user_id == current_user.id, UserLibrary.game_id == game.id)
        .values(last_played=now)
    )
    awards = []
    achievements = (
        await db.scalars(select(Achievement).where(Achievement.game_id == game.id))
    ).all()
    measurements = {**session.metrics, "score": data.score, "flight_seconds": data.playtime_seconds}
    for award in achievements:
        condition = award.unlock_condition or {}
        qualifies = bool(condition)
        for metric, threshold in condition.items():
            value = measurements.get(metric)
            if metric == "flight_seconds" and measurements.get("crashed") is not False:
                qualifies = False
            if isinstance(threshold, bool):
                qualifies &= value is threshold
            elif isinstance(threshold, (int, float)) and isinstance(value, (int, float)):
                qualifies &= value >= threshold
            else:
                qualifies = False
        if qualifies:
            created = await db.execute(
                insert(AchievementUnlocked)
                .values(user_id=current_user.id, achievement_id=award.id)
                .on_conflict_do_nothing()
                .returning(AchievementUnlocked.id)
            )
            if created.scalar_one_or_none() is not None:
                awards.append(
                    {"slug": award.slug, "title": award.title, "description": award.description}
                )
    result = {
        "session_id": str(data.session_id),
        "high_score": record.high_score,
        "previous_high_score": previous_high,
        "best_time_ms": best_time,
        "previous_best_time_ms": previous_time,
        "is_new_best_time": new_time,
        "is_new_high_score": new_high,
        "awards": awards,
        "medal": session.metrics.get("medal"),
        "total_playtime": stats.total_playtime_seconds,
    }
    session.completion = {"payload": payload, "result": result}
    if data.metrics.completed or data.metrics.crashed:
        await db.execute(
            delete(RecoverySave).where(
                RecoverySave.user_id == current_user.id,
                RecoverySave.game_id == game.id,
                RecoverySave.data["session_id"].as_string() == str(data.session_id),
            )
        )
    await db.commit()
    return result


@router.get("/records")
async def records(current_user: CurrentUser, db: DbSession, household: bool = False):
    query = (
        select(GameRecord, Game.slug, User.username)
        .join(Game, Game.id == GameRecord.game_id)
        .join(User, User.id == GameRecord.user_id)
        .where(User.is_active.is_(True))
    )
    if not household:
        query = query.where(GameRecord.user_id == current_user.id)
    rows = (await db.execute(query.order_by(GameRecord.high_score.desc(), GameRecord.id))).all()
    time_rows = (
        await db.execute(
            select(
                GameSession.user_id,
                GameSession.game_id,
                GameSession.mode,
                func.coalesce(GameSession.difficulty, "normal"),
                GameSession.rules_version,
                func.min(GameSession.metrics["elapsed_ms"].as_integer()),
            )
            .where(
                GameSession.end_time.is_not(None),
                GameSession.metrics["completed"].as_boolean().is_(True),
                GameSession.metrics["elapsed_ms"].as_integer() > 0,
                *([] if household else [GameSession.user_id == current_user.id]),
            )
            .group_by(
                GameSession.user_id,
                GameSession.game_id,
                GameSession.mode,
                func.coalesce(GameSession.difficulty, "normal"),
                GameSession.rules_version,
            )
        )
    ).all()
    times = {tuple(row[:5]): row[5] for row in time_rows}
    return [
        {
            "game_slug": slug,
            "player": name,
            "profile_id": r.user_id,
            "mode": r.mode,
            "difficulty": r.difficulty,
            "rules_version": r.rules_version,
            "high_score": r.high_score,
            "best_time_ms": times.get((r.user_id, r.game_id, r.mode, r.difficulty, r.rules_version))
            if time_ranked(slug, r.mode, r.rules_version)
            else None,
        }
        for r, slug, name in rows
    ]


@router.get("/history")
async def history(
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    game_id: int | None = Query(None, ge=1),
):
    from app.routers.stats import get_session_history

    total = await db.scalar(
        select(func.count())
        .select_from(GameSession)
        .where(
            GameSession.user_id == current_user.id,
            GameSession.end_time.is_not(None),
            *([GameSession.game_id == game_id] if game_id is not None else []),
        )
    )
    rows = await get_session_history(current_user, db, game_id=game_id, skip=skip, limit=limit)
    return {"sessions": rows, "total": total, "skip": skip, "limit": limit}


@router.get("/recovery")
async def recoveries(current_user: CurrentUser, db: DbSession):
    rows = (
        await db.execute(
            select(RecoverySave, Game.slug)
            .join(Game, Game.id == RecoverySave.game_id)
            .where(RecoverySave.user_id == current_user.id)
            .order_by(RecoverySave.updated_at.desc())
        )
    ).all()
    return [
        {"game_slug": slug, "data": row.data, "updated_at": row.updated_at} for row, slug in rows
    ]


@router.put("/recovery/{slug}")
async def save_recovery(slug: str, data: SaveUpdate, current_user: CurrentUser, db: DbSession):
    game = await get_game(slug, db)
    statement = insert(RecoverySave).values(
        user_id=current_user.id, game_id=game.id, data=data.data, updated_at=utc_now()
    )
    await db.execute(
        statement.on_conflict_do_update(
            index_elements=["user_id", "game_id"],
            set_={"data": statement.excluded.data, "updated_at": statement.excluded.updated_at},
        )
    )
    await db.commit()
    return {"saved": True}


@router.delete("/recovery/{slug}")
async def delete_recovery(
    slug: str, current_user: CurrentUser, db: DbSession, session_id: str | None = None
):
    game = await get_game(slug, db, include_inactive=True)
    query = delete(RecoverySave).where(
        RecoverySave.user_id == current_user.id, RecoverySave.game_id == game.id
    )
    if session_id:
        query = query.where(RecoverySave.data["session_id"].as_string() == session_id)
    await db.execute(query)
    await db.commit()
    return {"deleted": True}
