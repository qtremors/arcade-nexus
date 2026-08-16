"""Race-safe save-slot writes and profile isolation."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert

from app.datetime_utils import utc_now
from app.dependencies import CurrentUser, DbSession
from app.models.save import GameSave
from app.schemas.save import SaveCreate, SaveListResponse, SaveResponse, SaveUpdate
from app.services.common import get_game

router = APIRouter()
SlotPath = Annotated[int, Path(ge=1, le=5)]


def response(save: GameSave, slug: str) -> SaveResponse:
    return SaveResponse(
        id=save.id,
        game_slug=slug,
        slot=save.slot,
        name=save.name,
        data=save.data,
        thumbnail=save.thumbnail,
        created_at=save.created_at,
        updated_at=save.updated_at,
    )


@router.get("/{game_slug}", response_model=SaveListResponse)
async def list_saves(game_slug: str, current_user: CurrentUser, db: DbSession):
    game = await get_game(game_slug, db, include_inactive=True)
    saves = (
        await db.scalars(
            select(GameSave)
            .where(GameSave.user_id == current_user.id, GameSave.game_id == game.id)
            .order_by(GameSave.slot)
        )
    ).all()
    return SaveListResponse(saves=[response(save, game_slug) for save in saves], total=len(saves))


@router.post("/{game_slug}", response_model=SaveResponse, status_code=status.HTTP_201_CREATED)
async def create_save(
    game_slug: str,
    save_data: SaveCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    game = await get_game(game_slug, db)
    statement = insert(GameSave).values(
        user_id=current_user.id, game_id=game.id, **save_data.model_dump()
    )
    statement = statement.on_conflict_do_update(
        index_elements=["user_id", "game_id", "slot"],
        set_={
            "name": statement.excluded.name,
            "data": statement.excluded.data,
            "thumbnail": statement.excluded.thumbnail,
            "updated_at": utc_now(),
        },
    ).returning(GameSave.id)
    save_id = (await db.execute(statement)).scalar_one()
    await db.commit()
    return response(await db.get(GameSave, save_id), game_slug)


@router.put("/{game_slug}/{slot}", response_model=SaveResponse)
async def update_save(
    game_slug: str,
    slot: SlotPath,
    save_data: SaveUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    game = await get_game(game_slug, db)
    # Omitted optional metadata retains its value; explicit null clears it.
    values = save_data.model_dump(exclude_unset=True)
    values["updated_at"] = utc_now()
    result = await db.execute(
        update(GameSave)
        .where(
            GameSave.user_id == current_user.id,
            GameSave.game_id == game.id,
            GameSave.slot == slot,
        )
        .values(**values)
        .returning(GameSave.id)
    )
    save_id = result.scalar_one_or_none()
    if save_id is None:
        raise HTTPException(404, "Save not found")
    await db.commit()
    return response(await db.get(GameSave, save_id), game_slug)


@router.delete("/{game_slug}/{slot}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_save(game_slug: str, slot: SlotPath, current_user: CurrentUser, db: DbSession):
    game = await get_game(game_slug, db, include_inactive=True)
    save = await db.scalar(
        select(GameSave).where(
            GameSave.user_id == current_user.id, GameSave.game_id == game.id, GameSave.slot == slot
        )
    )
    if save is None:
        raise HTTPException(404, "Save not found")
    await db.delete(save)
    await db.commit()
