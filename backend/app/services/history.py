"""One filtered, stable history query for rows and their total."""

from datetime import datetime
from typing import Literal

from sqlalchemy import func, select

from app.models import Game, GameSession
from app.schemas.stats import SessionResponse

HistorySort = Literal["end_time", "score", "duration_seconds", "game_title", "difficulty"]


def history_query(
    user_id: int,
    *,
    game_id: int | None = None,
    mode: str | None = None,
    difficulty: str | None = None,
    since: datetime | None = None,
    before: datetime | None = None,
    sort: HistorySort = "end_time",
    direction: Literal["asc", "desc"] = "desc",
):
    query = (
        select(GameSession)
        .join(Game)
        .where(GameSession.user_id == user_id, GameSession.end_time.is_not(None))
    )
    for column, value in (
        (GameSession.game_id, game_id),
        (GameSession.mode, mode),
        (func.coalesce(GameSession.difficulty, "normal"), difficulty),
    ):
        if value is not None:
            query = query.where(column == value)
    if since is not None:
        query = query.where(GameSession.end_time >= since)
    if before is not None:
        query = query.where(GameSession.end_time < before)
    column = {
        "end_time": GameSession.end_time,
        "score": GameSession.score,
        "duration_seconds": GameSession.duration_seconds,
        "game_title": Game.title,
        "difficulty": func.coalesce(GameSession.difficulty, "normal"),
    }[sort]
    order = (lambda value: value.asc()) if direction == "asc" else (lambda value: value.desc())
    return query.order_by(order(column), order(GameSession.id))


def session_response(session: GameSession) -> SessionResponse:
    return SessionResponse(
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
        mode=session.mode,
        rules_version=session.rules_version,
    )
