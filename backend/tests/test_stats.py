"""Session replay, statistics, validation, and concurrent updates."""

import asyncio
from uuid import uuid4

import httpx2 as httpx
import pytest


def test_legacy_session_flow(player):
    assert player.post("/api/stats/snake/start").json()["sessions_count"] == 1
    assert (
        player.post(
            "/api/stats/snake/session", json={"playtime_seconds": 10, "score": 20}
        ).status_code
        == 200
    )
    stats = player.get("/api/stats/snake").json()
    assert stats["sessions_count"] == 1
    assert stats["total_playtime_seconds"] == 10
    assert player.post("/api/stats/snake/start").json()["sessions_count"] == 2
    history = player.get("/api/stats/sessions").json()
    assert len(history) == 1  # unfinished sessions are not completed history
    assert history[0]["score"] == 20
    assert history[0]["start_time"].endswith("Z")
    assert history[0]["end_time"].endswith("Z")


def test_legacy_completion_without_a_start_is_still_accepted(player):
    response = player.post("/api/stats/snake/session", json={"playtime_seconds": 12, "score": 30})
    assert response.status_code == 200
    assert response.json()["total_playtime"] == 12
    assert player.get("/api/stats/snake").json()["sessions_count"] == 1
    totals = player.get("/api/stats").json()
    assert totals["total_sessions"] == 1 and totals["total_games_played"] == 1
    replay = player.post(
        "/api/stats/snake/session",
        json={"session_id": response.json()["session_id"], "playtime_seconds": 12, "score": 30},
    )
    assert replay.status_code == 200
    assert player.get("/api/stats/snake").json()["sessions_count"] == 1
    assert player.get("/api/stats/sessions").json()[0]["duration_seconds"] == 12


def test_session_start_and_completion_are_idempotent(player):
    session_id = str(uuid4())
    for _ in range(2):
        started = player.post("/api/stats/snake/start", json={"session_id": session_id})
        assert started.json()["sessions_count"] == 1
    body = {"session_id": session_id, "playtime_seconds": 30, "score": 50, "difficulty": "hard"}
    for _ in range(2):
        recorded = player.post("/api/stats/snake/session", json=body)
        assert recorded.status_code == 200
        assert recorded.json()["total_playtime"] == 30
    assert len(player.get("/api/stats/sessions").json()) == 1
    assert player.post("/api/stats/snake/session", json={**body, "score": 51}).status_code == 409
    assert player.get("/api/stats").json()["total_playtime_seconds"] == 30


def test_explicit_session_cannot_be_finished_for_another_game_or_profile(player, profile):
    session_id = player.post("/api/stats/snake/start").json()["session_id"]
    other = player.post("/api/profiles", json={"username": "Other"}).json()
    body = {"session_id": session_id, "playtime_seconds": 10}
    assert player.post("/api/stats/raptor-run/session", json=body).status_code == 404
    player.post(f"/api/profiles/{other['id']}/activate")
    assert player.post("/api/stats/snake/session", json=body).status_code == 404
    assert (
        player.post(
            "/api/stats/snake/session", json=body, headers={"X-Profile-ID": str(profile["id"])}
        ).status_code
        == 200
    )
    assert player.get("/api/stats").json()["total_playtime_seconds"] == 0


def test_session_uuid_collision_does_not_increment_other_stats(player):
    session_id = str(uuid4())
    player.post("/api/stats/snake/start", json={"session_id": session_id})
    assert (
        player.post("/api/stats/raptor-run/start", json={"session_id": session_id}).status_code
        == 409
    )
    assert player.get("/api/stats/raptor-run").json()["sessions_count"] == 0


def test_score_zero_and_lower_score_preserve_high_score(player):
    assert not player.post("/api/stats/snake/score", json={"score": 0}).json()["is_new_high_score"]
    assert player.post("/api/stats/snake/score", json={"score": 100}).json()["is_new_high_score"]
    response = player.post("/api/stats/snake/score", json={"score": 50}).json()
    assert response["high_score"] == 100
    assert not response["is_new_high_score"]
    assert player.get("/api/stats").json()["total_games_played"] == 0


@pytest.mark.parametrize(
    "body",
    [
        {"playtime_seconds": -1},
        {"playtime_seconds": 604801},
        {"playtime_seconds": 10**40},
        {"playtime_seconds": True},
        {"playtime_seconds": 1, "score": -1},
        {"playtime_seconds": 1, "score": 10**40},
        {"playtime_seconds": 1, "difficulty": "impossible"},
        {"playtime_seconds": 1, "session_id": "not-a-uuid"},
    ],
)
def test_invalid_session_payload_is_rejected(player, body):
    assert player.post("/api/stats/snake/session", json=body).status_code == 422
    assert player.get("/api/stats").json()["total_playtime_seconds"] == 0


@pytest.mark.parametrize("score", [-1, 10**40, True, 1.5])
def test_invalid_score_is_rejected(player, score):
    assert player.post("/api/stats/snake/score", json={"score": score}).status_code == 422


def test_history_pagination_and_filtering(player, game_ids):
    for score in (10, 20, 30):
        player.post("/api/stats/snake/start")
        player.post("/api/stats/snake/session", json={"playtime_seconds": score, "score": score})
    history = player.get("/api/stats/sessions", params={"limit": 1, "skip": 1}).json()
    assert len(history) == 1 and history[0]["score"] == 20
    assert (
        player.get("/api/stats/sessions", params={"game_id": game_ids["raptor-run"]}).json() == []
    )


def test_concurrent_first_scores_and_session_replays(player):
    session_id = str(uuid4())

    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=player.app), base_url="http://testserver"
        ) as connection:
            scores = await asyncio.gather(
                *[
                    connection.post("/api/stats/snake/score", json={"score": score})
                    for score in (3, 100, 1, 500, 20, 400)
                ]
            )
            assert all(response.status_code == 200 for response in scores)
            starts = await asyncio.gather(
                *[
                    connection.post("/api/stats/snake/start", json={"session_id": session_id})
                    for _ in range(4)
                ]
            )
            assert all(response.status_code == 200 for response in starts)
            completions = await asyncio.gather(
                *[
                    connection.post(
                        "/api/stats/snake/session",
                        json={
                            "session_id": session_id,
                            "playtime_seconds": 20,
                            "score": 500,
                        },
                    )
                    for _ in range(4)
                ]
            )
            assert all(response.status_code == 200 for response in completions)

    player.portal.call(requests)
    stats = player.get("/api/stats/snake").json()
    assert stats["high_score"] == 500
    assert stats["sessions_count"] == 1
    assert stats["total_playtime_seconds"] == 20
    assert len(player.get("/api/stats/sessions").json()) == 1
