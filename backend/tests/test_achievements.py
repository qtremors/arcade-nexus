"""Qualification, concurrent unlocks, counts, and profile isolation."""

import asyncio

import httpx2 as httpx


def test_score_conditions_are_required(player):
    body = {"game_slug": "snake", "achievement_slug": "score-50"}
    assert player.post("/api/achievements/unlock", json=body).status_code == 409
    player.post("/api/stats/snake/score", json={"score": 49})
    assert player.post("/api/achievements/unlock", json=body).status_code == 409
    player.post("/api/stats/snake/score", json={"score": 50})
    assert player.post("/api/achievements/unlock", json=body).status_code == 200
    assert (
        player.post("/api/achievements/unlock", json=body).json()["message"]
        == "Achievement already unlocked"
    )
    data = player.get("/api/achievements/snake").json()
    assert data["unlocked_count"] == 1
    unlocked = next(item for item in data["achievements"] if item["slug"] == "score-50")
    assert unlocked["unlocked_at"].endswith("Z")


def test_completed_session_score_qualifies_without_changing_high_score(player):
    player.post("/api/stats/snake/start")
    player.post("/api/stats/snake/session", json={"playtime_seconds": 10, "score": 100})
    assert (
        player.post(
            "/api/achievements/unlock",
            json={
                "game_slug": "snake",
                "achievement_slug": "score-100",
            },
        ).status_code
        == 200
    )
    assert player.post("/api/stats/snake/score", json={"score": 100}).json()["is_new_high_score"]


def test_unimplemented_game_events_are_not_falsely_awarded(player):
    assert (
        player.post(
            "/api/achievements/unlock",
            json={
                "game_slug": "stellar-flight",
                "achievement_slug": "orbit",
            },
        ).status_code
        == 409
    )
    assert (
        player.post(
            "/api/achievements/unlock",
            json={
                "game_slug": "snake",
                "achievement_slug": "missing",
            },
        ).status_code
        == 404
    )


def test_unlocks_are_scoped_and_paginated_counts_are_total(player, profile):
    player.post("/api/stats/snake/score", json={"score": 100})
    player.post(
        "/api/achievements/unlock", json={"game_slug": "snake", "achievement_slug": "score-100"}
    )
    other = player.post("/api/profiles", json={"username": "Other"}).json()
    player.post(f"/api/profiles/{other['id']}/activate")
    assert player.get("/api/achievements").json()["unlocked_count"] == 0
    result = player.get(
        "/api/achievements", params={"limit": 1}, headers={"X-Profile-ID": str(profile["id"])}
    ).json()
    assert result["total"] == 17
    assert result["unlocked_count"] == 1
    assert len(result["achievements"]) == 1


def test_concurrent_achievement_unlocks_create_one_record(player):
    player.post("/api/stats/snake/score", json={"score": 200})

    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=player.app), base_url="http://testserver"
        ) as connection:
            responses = await asyncio.gather(
                *[
                    connection.post(
                        "/api/achievements/unlock",
                        json={
                            "game_slug": "snake",
                            "achievement_slug": "score-200",
                        },
                    )
                    for _ in range(5)
                ]
            )
            assert all(response.status_code == 200 for response in responses)

    player.portal.call(requests)
    assert player.get("/api/achievements").json()["unlocked_count"] == 1


def test_game_measurements_qualify_actual_events(player):
    session_id = player.post("/api/stats/raptor-run/start").json()["session_id"]
    jump = {"game_slug": "raptor-run", "achievement_slug": "first-jump"}
    player.post("/api/stats/raptor-run/score", json={"score": 1000})
    assert player.post("/api/achievements/unlock", json=jump).status_code == 409
    body = {"session_id": session_id, "playtime_seconds": 2, "score": 0, "metrics": {"jumps": 1}}
    assert player.post("/api/stats/raptor-run/session", json=body).status_code == 200
    assert player.post("/api/achievements/unlock", json=jump).status_code == 200
    assert player.post("/api/stats/raptor-run/session", json=body).status_code == 200
    assert (
        player.post(
            "/api/stats/raptor-run/session", json={**body, "metrics": {"jumps": 2}}
        ).status_code
        == 409
    )


def test_flight_achievements_require_recorded_measurements_and_safe_duration(player):
    orbit = {"game_slug": "stellar-flight", "achievement_slug": "orbit"}
    ace = {"game_slug": "stellar-flight", "achievement_slug": "ace"}
    player.post(
        "/api/stats/stellar-flight/session",
        json={"playtime_seconds": 600, "metrics": {"max_altitude": 5000, "crashed": True}},
    )
    assert player.post("/api/achievements/unlock", json=orbit).status_code == 200
    assert player.post("/api/achievements/unlock", json=ace).status_code == 409
    player.post(
        "/api/stats/stellar-flight/session",
        json={"playtime_seconds": 599, "metrics": {"crashed": False}},
    )
    assert player.post("/api/achievements/unlock", json=ace).status_code == 409
    player.post(
        "/api/stats/stellar-flight/session",
        json={"playtime_seconds": 600, "metrics": {"crashed": False}},
    )
    assert player.post("/api/achievements/unlock", json=ace).status_code == 200


def test_measurements_are_bounded_and_unknown_fields_are_rejected(player):
    for metrics in (
        {"jumps": -1},
        {"jumps": True},
        {"jumps": 1000001},
        {"max_altitude": -1},
        {"max_altitude": 10000001},
        {"unknown": 10},
    ):
        assert (
            player.post(
                "/api/stats/snake/session", json={"playtime_seconds": 1, "metrics": metrics}
            ).status_code
            == 422
        )
