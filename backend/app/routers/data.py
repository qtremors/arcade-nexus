"""Portable, validated backups. Restore creates copies instead of overwriting players."""

import asyncio
import json
from collections import defaultdict
from datetime import datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import select, text
from starlette.responses import FileResponse

from app.dependencies import DbSession
from app.models import (
    Achievement,
    AchievementUnlocked,
    Game,
    GameRecord,
    GameSave,
    GameSession,
    PlayStats,
    RecoverySave,
    User,
    UserLibrary,
)
from app.schemas.base import RequestSchema, Slug
from app.schemas.save import SaveCreate, SaveUpdate
from app.schemas.stats import CompletionRecord, Score
from app.schemas.user import ProfileCreate

router = APIRouter()


class SavedSlot(SaveCreate):
    created_at: datetime
    updated_at: datetime


class SavedSession(CompletionRecord):
    start_time: datetime
    end_time: datetime


class SavedReservation(RequestSchema):
    session_id: UUID
    start_time: datetime


class SavedRecord(RequestSchema):
    mode: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    difficulty: Literal["easy", "normal", "hard"]
    rules_version: int = Field(ge=1, le=10000)
    high_score: Score


class SavedAward(RequestSchema):
    slug: Slug
    unlocked_at: datetime


class SavedGame(RequestSchema):
    slug: Slug
    favorite: bool = False
    playtime: int = Field(0, ge=0, le=2**53 - 1)
    sessions_count: int = Field(0, ge=0, le=2**31 - 1)
    high_score: Score = 0
    last_session: datetime | None = None
    saves: list[SavedSlot] = Field(default_factory=list, max_length=5)
    sessions: list[SavedSession] = Field(default_factory=list, max_length=100000)
    reservations: list[SavedReservation] = Field(default_factory=list, max_length=100000)
    records: list[SavedRecord] = Field(default_factory=list, max_length=1000)
    awards: list[SavedAward] = Field(default_factory=list, max_length=1000)
    recovery: SaveUpdate | None = None


class SavedPlayer(ProfileCreate):
    original_id: int = Field(ge=1)
    created_at: datetime
    games: list[SavedGame] = Field(default_factory=list, max_length=1000)


class Backup(RequestSchema):
    format: Literal[1]
    profiles: list[SavedPlayer] = Field(max_length=1000)


async def validate_backup(backup: Backup, db):
    if len({p.original_id for p in backup.profiles}) != len(backup.profiles):
        raise HTTPException(422, "Backup has duplicate player identities")
    catalog = {g.slug: g for g in (await db.scalars(select(Game))).all()}
    sessions = [
        str(s.session_id)
        for p in backup.profiles
        for g in p.games
        for s in [*g.sessions, *g.reservations]
    ]
    if len(set(sessions)) != len(sessions):
        raise HTTPException(422, "Backup has duplicate session identities")
    for player in backup.profiles:
        if len({g.slug for g in player.games}) != len(player.games):
            raise HTTPException(422, "Backup has duplicate game entries")
        for game in player.games:
            if game.slug not in catalog:
                raise HTTPException(
                    422, f"Install the game {game.slug} before restoring this backup"
                )
            if (
                len({s.slot for s in game.saves}) != len(game.saves)
                or len({(r.mode, r.difficulty, r.rules_version) for r in game.records})
                != len(game.records)
                or len({a.slug for a in game.awards}) != len(game.awards)
            ):
                raise HTTPException(422, "Backup has duplicate saves, records or awards")
    return catalog


@router.post("/preview")
async def preview_data(backup: Backup, db: DbSession):
    await validate_backup(backup, db)
    games = [game for player in backup.profiles for game in player.games]
    return {
        "profiles": len(backup.profiles),
        "profile_ids": [player.original_id for player in backup.profiles],
        "names": [player.username for player in backup.profiles],
        "games": len(games),
        "saves": sum(len(game.saves) for game in games),
        "sessions": sum(len(game.sessions) for game in games),
        "records": sum(len(game.records) for game in games),
        "recoveries": sum(game.recovery is not None for game in games),
    }


@router.get("/backups")
async def list_backups(request: Request):
    manager = request.app.state.backups
    return {
        "enabled": manager.enabled,
        "retention": manager.retention,
        "interval_hours": manager.interval / 3600,
        "backups": manager.snapshots(),
        "error": manager.error,
    }


@router.post("/backups")
async def create_backup(request: Request):
    manager = request.app.state.backups
    if not manager.enabled:
        raise HTTPException(409, "Automatic backups are disabled for this console")
    try:
        snapshot = await manager.create(force=True)
    except Exception:
        raise HTTPException(503, manager.error) from None
    if snapshot is None:
        raise HTTPException(409, "Create a player before taking a backup")
    return snapshot


def snapshot_path(request: Request, name: str):
    path = request.app.state.backups.path(name)
    if path is None:
        raise HTTPException(404, "This backup is no longer available")
    return path


@router.get("/backups/{name}")
async def download_backup(name: str, request: Request):
    return FileResponse(
        snapshot_path(request, name),
        media_type="application/json",
        filename=name,
        headers={"Cache-Control": "no-store"},
    )


async def saved_backup(name: str, request: Request):
    path = snapshot_path(request, name)

    def read():
        wrapper = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(wrapper, dict) or wrapper.get("format") != "arcade-nexus-backup-1":
            raise ValueError("Unsupported stored backup format")
        return Backup.model_validate(wrapper["database"])

    try:
        return await asyncio.to_thread(read)
    except (ValueError, KeyError, OSError):
        raise HTTPException(422, "This stored backup could not be read") from None


@router.post("/backups/{name}/preview")
async def preview_snapshot(name: str, request: Request, db: DbSession):
    return await preview_data(await saved_backup(name, request), db)


@router.post("/backups/{name}/restore")
async def restore_snapshot(name: str, request: Request, db: DbSession):
    return await import_data(await saved_backup(name, request), db)


@router.get("/export", response_model=Backup)
async def export_data(db: DbSession):
    await db.execute(text("BEGIN"))
    players = (
        await db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.id))
    ).all()
    catalog = (await db.scalars(select(Game).order_by(Game.id))).all()

    # Read one consistent snapshot with a bounded number of queries, including retired games.
    async def grouped(model):
        statement = (
            select(model)
            .join(User, User.id == model.user_id)
            .where(User.is_active.is_(True))
            .order_by(model.id)
        )
        result = defaultdict(list)
        for row in (await db.scalars(statement)).all():
            result[(row.user_id, row.game_id)].append(row)
        return result

    grouped_rows = {}
    for model in (PlayStats, GameSave, GameSession, GameRecord, RecoverySave, UserLibrary):
        grouped_rows[model] = await grouped(model)
    awards_by_owner = defaultdict(list)
    awards = await db.execute(
        select(
            AchievementUnlocked.user_id,
            Achievement.game_id,
            Achievement.slug,
            AchievementUnlocked.unlocked_at,
        )
        .join(Achievement, AchievementUnlocked.achievement_id == Achievement.id)
        .join(User, User.id == AchievementUnlocked.user_id)
        .where(User.is_active.is_(True))
        .order_by(AchievementUnlocked.id)
    )
    for user_id, game_id, slug, stamp in awards:
        awards_by_owner[(user_id, game_id)].append((slug, stamp))
    output = []
    for player in players:
        games = []
        for game in catalog:
            owner = (player.id, game.id)
            stats = next(iter(grouped_rows[PlayStats].get(owner, ())), None)
            slots = grouped_rows[GameSave].get(owner, ())
            sessions = grouped_rows[GameSession].get(owner, ())
            records = grouped_rows[GameRecord].get(owner, ())
            recovery = next(iter(grouped_rows[RecoverySave].get(owner, ())), None)
            favorite = bool(grouped_rows[UserLibrary].get(owner))
            awards = awards_by_owner.get(owner, ())
            if not any((stats, slots, sessions, records, recovery, favorite, awards)):
                continue
            games.append(
                dict(
                    slug=game.slug,
                    favorite=favorite,
                    playtime=stats.total_playtime_seconds if stats else 0,
                    sessions_count=stats.sessions_count if stats else 0,
                    high_score=stats.high_score if stats else 0,
                    last_session=stats.last_session if stats else None,
                    saves=[
                        dict(
                            slot=s.slot,
                            name=s.name,
                            data=s.data,
                            thumbnail=s.thumbnail,
                            created_at=s.created_at,
                            updated_at=s.updated_at,
                        )
                        for s in slots
                    ],
                    sessions=[
                        dict(
                            session_id=s.session_id or str(uuid4()),
                            score=s.score,
                            playtime_seconds=s.duration_seconds,
                            difficulty=s.difficulty,
                            metrics=s.metrics,
                            mode=s.mode,
                            rules_version=s.rules_version,
                            start_time=s.start_time,
                            end_time=s.end_time,
                        )
                        for s in sessions
                        if s.end_time is not None
                    ],
                    reservations=[
                        dict(session_id=s.session_id, start_time=s.start_time)
                        for s in sessions
                        if s.end_time is None and s.session_id is not None
                    ],
                    records=[
                        dict(
                            mode=r.mode,
                            difficulty=r.difficulty,
                            rules_version=r.rules_version,
                            high_score=r.high_score,
                        )
                        for r in records
                    ],
                    awards=[dict(slug=slug, unlocked_at=stamp) for slug, stamp in awards],
                    recovery=dict(data=recovery.data) if recovery else None,
                )
            )
        output.append(
            dict(
                original_id=player.id,
                username=player.username,
                avatar=player.avatar,
                created_at=player.created_at,
                games=games,
            )
        )
    return dict(format=1, profiles=output)


@router.post("/import")
async def import_data(backup: Backup, db: DbSession):
    await db.execute(text("BEGIN IMMEDIATE"))
    catalog = await validate_backup(backup, db)
    names = set((await db.scalars(select(User.username))).all())
    selected = await db.scalar(
        select(User.id).where(User.is_active.is_(True), User.is_default.is_(True))
    )
    mapping = {}
    session_mapping = {}

    def copied_session(identity):
        identity = str(identity)
        if identity not in session_mapping:
            session_mapping[identity] = str(uuid4())
        return session_mapping[identity]

    def copied_save(data, slug):
        # Save payloads are opaque except for our versioned session envelope.
        if data.get("format") not in (1, 2) or data.get("game") != slug:
            return data
        try:
            identity = UUID(str(data.get("session_id")))
        except (ValueError, TypeError, AttributeError):
            return data
        return {**data, "session_id": copied_session(identity)}

    for saved in backup.profiles:
        name = saved.username
        suffix = 1
        while name in names:
            name = f"{saved.username[:32]} (restored {suffix})"
            suffix += 1
        names.add(name)
        player = User(
            username=name,
            avatar=saved.avatar,
            created_at=saved.created_at,
            is_default=selected is None,
        )
        db.add(player)
        await db.flush()
        selected = selected or player.id
        mapping[str(saved.original_id)] = player.id
        for item in saved.games:
            game = catalog[item.slug]
            owner = dict(user_id=player.id, game_id=game.id)
            db.add(
                PlayStats(
                    **owner,
                    total_playtime_seconds=item.playtime,
                    sessions_count=item.sessions_count,
                    high_score=item.high_score,
                    last_session=item.last_session,
                )
            )
            if item.favorite:
                db.add(UserLibrary(**owner))
            for slot in item.saves:
                fields = slot.model_dump()
                fields["data"] = copied_save(slot.data, item.slug)
                db.add(GameSave(**owner, **fields))
            for record in item.records:
                db.add(GameRecord(**owner, **record.model_dump()))
            for session in item.sessions:
                restored_session_id = copied_session(session.session_id)
                fields = session.model_dump(exclude={"session_id", "playtime_seconds"})
                fields["metrics"] = session.metrics.model_dump(exclude_none=True)
                db.add(
                    GameSession(
                        **owner,
                        **fields,
                        session_id=restored_session_id,
                        duration_seconds=session.playtime_seconds,
                    )
                )
            for reservation in item.reservations:
                db.add(
                    GameSession(
                        **owner,
                        session_id=copied_session(reservation.session_id),
                        start_time=reservation.start_time,
                        end_time=None,
                    )
                )
            for award in item.awards:
                definition = await db.scalar(
                    select(Achievement).where(
                        Achievement.game_id == game.id, Achievement.slug == award.slug
                    )
                )
                if definition:
                    db.add(
                        AchievementUnlocked(
                            user_id=player.id,
                            achievement_id=definition.id,
                            unlocked_at=award.unlocked_at,
                        )
                    )
            if item.recovery:
                db.add(RecoverySave(**owner, data=copied_save(item.recovery.data, item.slug)))
    await db.commit()
    return {"imported": len(mapping), "profile_map": mapping, "session_map": session_mapping}
