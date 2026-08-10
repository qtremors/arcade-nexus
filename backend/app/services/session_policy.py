"""Shared legacy receipt equivalence, independent of HTTP routing."""

from app.models.session import GameSession
from app.schemas.stats import SessionRecord


def same_completion(session: GameSession, data: SessionRecord) -> bool:
    return (
        session.duration_seconds == data.playtime_seconds
        and session.score == data.score
        and session.difficulty == data.difficulty
        and (session.metrics or {}) == data.metrics.model_dump(exclude_none=True)
    )
