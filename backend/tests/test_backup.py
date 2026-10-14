"""Complete, scoped backups with query costs independent of household size."""

import sqlite3
from uuid import uuid4

from sqlalchemy import event


def complete(client, profile_id, slug, score):
    response = client.post(
        f"/api/progress/{slug}/complete",
        headers={"X-Profile-ID": str(profile_id)},
        json={"session_id": str(uuid4()), "playtime_seconds": 20, "score": score},
    )
    assert response.status_code == 200, response.text


def test_backup_preserves_owner_scoping_retired_games_and_complete_history(
    client, profile, settings, game_ids
):
    other = client.post("/api/profiles", json={"username": "Second"}).json()
    removed = client.post("/api/profiles", json={"username": "Removed"}).json()
    complete(client, profile["id"], "snake", 100)
    complete(client, other["id"], "breakout", 200)
    complete(client, removed["id"], "snake", 300)
    headers = {"X-Profile-ID": str(profile["id"])}
    assert (
        client.post(
            "/api/stats/snake/start", headers=headers, json={"session_id": str(uuid4())}
        ).status_code
        == 200
    )
    assert client.post("/api/library/" + str(game_ids["snake"]), headers=headers).status_code == 201
    assert (
        client.post(
            "/api/saves/snake", headers=headers, json={"slot": 1, "data": {"owner": profile["id"]}}
        ).status_code
        == 201
    )
    assert (
        client.put(
            "/api/progress/recovery/snake", headers=headers, json={"data": {"owner": profile["id"]}}
        ).status_code
        == 200
    )
    assert client.delete(f"/api/profiles/{removed['id']}").status_code == 204
    with sqlite3.connect(settings.DATABASE_URL.removeprefix("sqlite+aiosqlite:///")) as db:
        db.execute("UPDATE games SET is_active=0 WHERE slug='breakout'")
    response = client.get("/api/data/export")
    assert response.status_code == 200, response.text
    backup = response.json()
    players = {p["original_id"]: p for p in backup["profiles"]}
    assert set(players) == {profile["id"], other["id"]}
    first = players[profile["id"]]["games"][0]
    assert first["slug"] == "snake"
    assert first["high_score"] == 100
    assert first["favorite"] is True
    assert len(first["sessions"]) == 1  # Unfinished reservations are not completed history.
    assert first["saves"][0]["data"] == {"owner": profile["id"]}
    assert first["recovery"]["data"] == {"owner": profile["id"]}
    assert first["records"] and first["awards"]
    assert players[other["id"]]["games"][0]["slug"] == "breakout"
    assert players[other["id"]]["games"][0]["high_score"] == 200
    restored = client.post("/api/data/import", json=backup)
    assert restored.status_code == 200, restored.text


def test_backup_query_count_does_not_grow_per_player_or_game(client, profile, app):
    queries = []

    def record(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(app.state.engine.sync_engine, "before_cursor_execute", record)
    try:
        first = client.get("/api/data/export")
        assert first.status_code == 200, first.text
        initial_count = len(queries)
        for index in range(12):
            assert (
                client.post("/api/profiles", json={"username": f"Extra {index}"}).status_code == 201
            )
        queries.clear()
        second = client.get("/api/data/export")
        assert second.status_code == 200, second.text
        assert len(second.json()["profiles"]) == 13
        assert 0 < len(queries) == initial_count <= 10
    finally:
        event.remove(app.state.engine.sync_engine, "before_cursor_execute", record)


def test_restore_remaps_server_envelopes_and_unfinished_session_identities(player, profile):
    finished, unfinished = str(uuid4()), str(uuid4())
    assert (
        player.post(
            "/api/progress/snake/complete",
            json={
                "session_id": finished,
                "playtime_seconds": 12,
                "score": 30,
                "metrics": {"completed": True},
            },
        ).status_code
        == 200
    )
    for slot, identity in ((1, finished), (2, unfinished)):
        assert (
            player.post(
                "/api/saves/snake",
                json={"slot": slot, "data": {"format": 2, "game": "snake", "session_id": identity}},
            ).status_code
            == 201
        )
    player.put(
        "/api/progress/recovery/snake",
        json={"data": {"format": 2, "game": "snake", "session_id": finished}},
    )
    backup = player.get("/api/data/export").json()
    response = player.post("/api/data/import", json=backup)
    assert response.status_code == 200, response.text
    restored = response.json()
    mapping = restored["session_map"]
    assert set(mapping) == {finished, unfinished}
    assert all(mapping[key] != key for key in mapping)
    copied = {"X-Profile-ID": str(restored["profile_map"][str(profile["id"])])}
    saves = player.get("/api/saves/snake", headers=copied).json()["saves"]
    assert [slot["data"]["session_id"] for slot in saves] == [
        mapping[finished],
        mapping[unfinished],
    ]
    assert player.get("/api/saves/snake").json()["saves"][0]["data"]["session_id"] == finished
    assert (
        player.get("/api/progress/recovery", headers=copied).json()[0]["data"]["session_id"]
        == mapping[finished]
    )
    # Replayed terminal completion clears only the copied recovery.
    response = player.post(
        "/api/progress/snake/complete",
        headers=copied,
        json={
            "session_id": mapping[finished],
            "playtime_seconds": 12,
            "score": 30,
            "metrics": {"completed": True},
        },
    )
    assert response.status_code == 200
    assert player.get("/api/progress/recovery", headers=copied).json() == []
    assert player.get("/api/progress/recovery").json()[0]["data"]["session_id"] == finished


def test_restore_keeps_reserved_sessions_so_queued_completions_count_once(player, profile):
    identity = str(uuid4())
    player.post("/api/stats/snake/start", json={"session_id": identity})
    backup = player.get("/api/data/export").json()
    game = backup["profiles"][0]["games"][0]
    assert game["sessions"] == []
    assert game["reservations"][0]["session_id"] == identity
    restored = player.post("/api/data/import", json=backup).json()
    copied = {"X-Profile-ID": str(restored["profile_map"][str(profile["id"])])}
    data = {"session_id": restored["session_map"][identity], "playtime_seconds": 12, "score": 30}
    for _ in range(2):
        response = player.post("/api/progress/snake/complete", headers=copied, json=data)
        assert response.status_code == 200, response.text
    stats = player.get("/api/stats/snake", headers=copied).json()
    assert stats["sessions_count"] == 1
    assert stats["total_playtime_seconds"] == 12
    assert player.get("/api/progress/history", headers=copied).json()["total"] == 1
    assert player.get("/api/stats/snake").json()["total_playtime_seconds"] == 0
