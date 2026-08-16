"""One transaction per result, replayable receipts, recovery and household records."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime
from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import selectinload

from app.datetime_utils import utc_now
from app.dependencies import CurrentUser, DbSession
from app.game_rules import time_ranked
from app.models import (
    Game,
    GameRecord,
    GameSession,
    RecoverySave,
    User,
)
from app.schemas.progress import (
    CompletionReceipt,
    DeletedResponse,
    HistoryOptions,
    HistoryResponse,
    ModeRecord,
    RecoveryResponse,
    SavedResponse,
)
from app.schemas.save import SaveUpdate
from app.schemas.stats import CompletionRecord
from app.services.common import get_game
from app.services.history import HistorySort, history_query, session_response
from app.services.sessions import complete_session

router = APIRouter()


@router.get("/records", response_model=list[ModeRecord])
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


@router.get("/history", response_model=HistoryResponse)
async def history(
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    game_id: int | None = Query(None, ge=1),
    mode: str | None = Query(None, pattern=r"^[a-z0-9-]{1,40}$"),
    difficulty: Literal["easy", "normal", "hard"] | None = None,
    since: AwareDatetime | None = None,
    before: AwareDatetime | None = None,
    sort: HistorySort = "end_time",
    direction: Literal["asc", "desc"] = "desc",
):
    if since and before and since >= before:
        raise HTTPException(422, "The end of the date range must be after its start")
    query = history_query(
        current_user.id,
        game_id=game_id,
        mode=mode,
        difficulty=difficulty,
        since=since,
        before=before,
        sort=sort,
        direction=direction,
    )
    total = await db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    sessions = (
        await db.scalars(query.offset(skip).limit(limit).options(selectinload(GameSession.game)))
    ).all()
    rows = [session_response(session) for session in sessions]
    return {"sessions": rows, "total": total, "skip": skip, "limit": limit}


@router.get("/history/options", response_model=HistoryOptions)
async def history_options(current_user: CurrentUser, db: DbSession):
    rows = (
        await db.execute(
            select(Game.id, Game.slug, Game.title, GameSession.mode)
            .join(GameSession, GameSession.game_id == Game.id)
            .where(GameSession.user_id == current_user.id, GameSession.end_time.is_not(None))
            .distinct()
            .order_by(Game.title, GameSession.mode)
        )
    ).all()
    games = {}
    for game_id, slug, title, mode in rows:
        game = games.setdefault(game_id, {"id": game_id, "slug": slug, "title": title, "modes": []})
        game["modes"].append(mode)
    return {"games": list(games.values())}


@router.get("/recovery", response_model=list[RecoveryResponse])
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


@router.put("/recovery/{slug}", response_model=SavedResponse)
async def save_recovery(slug: str, data: SaveUpdate, current_user: CurrentUser, db: DbSession):
    await db.execute(text("BEGIN IMMEDIATE"))
    game = await get_game(slug, db)
    identity = data.data.get("session_id")
    if isinstance(identity, str):
        finished = await db.scalar(
            select(GameSession).where(
                GameSession.session_id == identity,
                GameSession.user_id == current_user.id,
                GameSession.game_id == game.id,
                GameSession.end_time.is_not(None),
            )
        )
        if finished and finished.metrics.get("ended") is True:
            raise HTTPException(409, "This run has already ended")
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


@router.delete("/recovery/{slug}", response_model=DeletedResponse)
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


@router.post("/{slug}/complete", response_model=CompletionReceipt)
async def complete(slug: str, data: CompletionRecord, current_user: CurrentUser, db: DbSession):
    return await complete_session(slug, data, current_user, db)
