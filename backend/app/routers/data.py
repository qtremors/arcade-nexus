"""Portable, validated backups. Restore creates copies instead of overwriting players."""

from datetime import datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select, text

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


@router.get("/export", response_model=Backup)
async def export_data(db: DbSession):
    await db.execute(text("BEGIN"))
    players = (await db.scalars(select(User).where(User.is_active.is_(True)))).all()
    catalog = (await db.scalars(select(Game))).all()
    output = []
    for player in players:
        games = []
        for game in catalog:

            async def rows(model):
                return (
                    await db.scalars(select(model).filter_by(user_id=player.id, game_id=game.id))
                ).all()

            stats = next(iter(await rows(PlayStats)), None)
            slots = await rows(GameSave)
            sessions = await rows(GameSession)
            records = await rows(GameRecord)
            recovery = next(iter(await rows(RecoverySave)), None)
            favorite = bool(await rows(UserLibrary))
            awards = (
                await db.execute(
                    select(Achievement.slug, AchievementUnlocked.unlocked_at)
                    .join(AchievementUnlocked, AchievementUnlocked.achievement_id == Achievement.id)
                    .where(Achievement.game_id == game.id, AchievementUnlocked.user_id == player.id)
                )
            ).all()
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
    if len({p.original_id for p in backup.profiles}) != len(backup.profiles):
        raise HTTPException(422, "Backup has duplicate player identities")
    catalog = {g.slug: g for g in (await db.scalars(select(Game))).all()}
    names = set((await db.scalars(select(User.username))).all())
    selected = await db.scalar(
        select(User.id).where(User.is_active.is_(True), User.is_default.is_(True))
    )
    mapping = {}
    session_mapping = {}
    all_sessions = [str(s.session_id) for p in backup.profiles for g in p.games for s in g.sessions]
    if len(set(all_sessions)) != len(all_sessions):
        raise HTTPException(422, "Backup has duplicate session identities")
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
        if len({g.slug for g in saved.games}) != len(saved.games):
            raise HTTPException(422, "Backup has duplicate game entries")
        for item in saved.games:
            if (
                len({s.slot for s in item.saves}) != len(item.saves)
                or len({(r.mode, r.difficulty, r.rules_version) for r in item.records})
                != len(item.records)
                or len({a.slug for a in item.awards}) != len(item.awards)
            ):
                raise HTTPException(422, "Backup has duplicate saves, records or awards")
            game = catalog.get(item.slug)
            if game is None:
                raise HTTPException(
                    422, f"Install the game {item.slug} before restoring this backup"
                )
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
                db.add(GameSave(**owner, **slot.model_dump()))
            for record in item.records:
                db.add(GameRecord(**owner, **record.model_dump()))
            for session in item.sessions:
                restored_session_id = str(uuid4())
                session_mapping[str(session.session_id)] = restored_session_id
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
                db.add(RecoverySave(**owner, data=item.recovery.data))
    await db.commit()
    return {"imported": len(mapping), "profile_map": mapping, "session_map": session_mapping}
