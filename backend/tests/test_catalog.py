"""Literal search, development creation, membership, and catalog sync."""

import asyncio
from copy import deepcopy

import httpx2 as httpx
from sqlalchemy import update

from app.models.game import Game
from app.seed import INITIAL_GAMES, sync_games


def test_creation_is_disabled_by_default(client):
    assert client.post("/api/games", json={"slug": "custom", "title": "Custom"}).status_code == 403


def test_literal_search_and_pagination(client):
    client.app.state.settings.ALLOW_GAME_CREATION = True
    assert (
        client.post(
            "/api/games",
            json={
                "slug": "literal",
                "title": r"Puzzle_100%\test",
                "config": {"grid_size": 20},
            },
        ).status_code
        == 201
    )
    for search in ("_", "%", "\\", "100%"):
        result = client.get("/api/games", params={"search": search}).json()
        assert result["total"] == 1
        assert result["games"][0]["slug"] == "literal"
    assert client.get("/api/games", params={"search": "   "}).json()["total"] == 6
    page = client.get("/api/games", params={"limit": 1, "skip": 1}).json()
    assert page["total"] == 6 and len(page["games"]) == 1
    assert client.get("/api/games/literal").json()["config"] == {"grid_size": 20}
    assert (
        client.post("/api/games", json={"slug": "literal", "title": "Duplicate"}).status_code == 400
    )


def test_library_order_and_removal_preserve_progress(player, game_ids):
    snake = game_ids["snake"]
    raptor = game_ids["raptor-run"]
    assert player.post(f"/api/library/{snake}").status_code == 201
    assert player.post(f"/api/library/{raptor}").status_code == 201
    assert player.post(f"/api/library/{snake}").status_code == 400
    player.post("/api/stats/snake/start")
    player.post("/api/saves/snake", json={"slot": 1, "data": {"score": 10}})
    entries = player.get("/api/library").json()
    assert entries[0]["game"]["slug"] == "snake"
    assert len(player.get("/api/library", params={"limit": 1}).json()) == 1
    assert player.delete(f"/api/library/{snake}").status_code == 204
    assert player.get("/api/saves/snake").json()["total"] == 1
    assert player.get("/api/stats/snake").json()["sessions_count"] == 1


def test_catalog_sync_is_repeatable_and_preserves_progress(player):
    original = deepcopy(INITIAL_GAMES)
    player.post("/api/saves/snake", json={"slot": 1, "data": {"score": 100}})

    async def sync():
        await sync_games(skip_init=True, session_factory=player.app.state.session_factory)
        await sync_games(skip_init=True, session_factory=player.app.state.session_factory)

    player.portal.call(sync)
    assert INITIAL_GAMES == original
    assert player.get("/api/achievements").json()["total"] == 22
    assert player.get("/api/saves/snake").json()["saves"][0]["data"]["score"] == 100


def test_inactive_games_preserve_history_and_saves_but_reject_new_play(player, game_ids):
    player.post(f"/api/library/{game_ids['snake']}")
    player.post("/api/saves/snake", json={"slot": 1, "data": {"score": 50}})
    player.post("/api/stats/snake/score", json={"score": 50})

    async def deactivate():
        async with player.app.state.session_factory() as db:
            await db.execute(update(Game).where(Game.slug == "snake").values(is_active=False))
            await db.commit()

    player.portal.call(deactivate)
    assert player.get("/api/games/snake").status_code == 404
    assert player.get("/api/library").json() == []
    assert player.get("/api/saves/snake").json()["total"] == 1
    assert player.get("/api/stats/snake").json()["high_score"] == 50
    assert player.post("/api/stats/snake/start").status_code == 404
    assert player.post("/api/stats/snake/score", json={"score": 100}).status_code == 404
    assert player.post("/api/saves/snake", json={"slot": 1, "data": {}}).status_code == 404
    assert player.get("/api/achievements").json()["total"] == 18
    assert player.delete("/api/saves/snake/1").status_code == 204


def test_concurrent_library_membership_is_consistent(player, game_ids):
    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=player.app), base_url="http://testserver"
        ) as connection:
            responses = await asyncio.gather(
                *[connection.post(f"/api/library/{game_ids['snake']}") for _ in range(4)]
            )
            assert sorted(response.status_code for response in responses) == [201, 400, 400, 400]

    player.portal.call(requests)
    assert len(player.get("/api/library").json()) == 1


def test_unknown_game_requests_do_not_create_player_stats(player):
    for route in ("/api/stats/unknown/start", "/api/stats/unknown/score"):
        response = player.post(route, json={"score": 10} if route.endswith("score") else None)
        assert response.status_code == 404
    assert player.get("/api/stats").json()["games"] == []


def test_an_existing_session_can_finish_after_a_game_is_retired(player):
    session_id = player.post("/api/stats/snake/start").json()["session_id"]

    async def deactivate():
        async with player.app.state.session_factory() as db:
            await db.execute(update(Game).where(Game.slug == "snake").values(is_active=False))
            await db.commit()

    player.portal.call(deactivate)
    body = {"session_id": session_id, "playtime_seconds": 30, "score": 50}
    assert player.post("/api/stats/snake/session", json=body).status_code == 200
    assert player.post("/api/stats/snake/session", json=body).json()["total_playtime"] == 30
    assert player.post("/api/stats/snake/session", json={"playtime_seconds": 1}).status_code == 404
    assert player.get("/api/stats/snake").json()["total_playtime_seconds"] == 30
