from uuid import uuid4


def payload(**changes):
    return dict(
        session_id=str(uuid4()),
        playtime_seconds=20,
        score=100,
        difficulty="normal",
        mode="classic",
        rules_version=1,
        metrics={},
        **changes,
    )


def test_completion_receipt_is_atomic_and_replayed(player):
    data = payload()
    first = player.post("/api/progress/snake/complete", json=data)
    assert first.status_code == 200, first.text
    result = first.json()
    assert result["is_new_high_score"] is True
    assert len(result["awards"]) == 3
    assert player.post("/api/progress/snake/complete", json=data).json() == result
    assert player.get("/api/stats/snake").json()["total_playtime_seconds"] == 20
    assert player.get("/api/stats/snake").json()["sessions_count"] == 1
    assert player.get("/api/achievements/snake").json()["unlocked_count"] == 3
    assert (
        player.post("/api/progress/snake/complete", json={**data, "score": 200}).status_code == 409
    )


def test_records_are_separate_and_old_completion_queue_can_upgrade(player):
    data = payload()
    player.post("/api/stats/snake/start", json={"session_id": data["session_id"]})
    legacy = {k: v for k, v in data.items() if k not in {"mode", "rules_version"}}
    assert player.post("/api/stats/snake/session", json=legacy).status_code == 200
    assert player.post("/api/progress/snake/complete", json=data).status_code == 200
    hard = {**data, "session_id": str(uuid4()), "difficulty": "hard", "score": 10}
    assert (
        player.post("/api/progress/snake/complete", json=hard).json()["is_new_high_score"] is True
    )
    assert player.get("/api/stats/snake").json()["total_playtime_seconds"] == 40
    assert len(player.get("/api/progress/records").json()) == 2


def test_recovery_is_separate_scoped_and_removed_only_for_completed_run(player, profile):
    data = {**payload(), "metrics": {"completed": True}}
    recovery = {"data": {"session_id": data["session_id"], "format": 2, "state": {"score": 100}}}
    assert player.put("/api/progress/recovery/snake", json=recovery).status_code == 200
    assert player.get("/api/saves/snake").json()["total"] == 0
    another = player.post("/api/profiles", json={"username": "Other"}).json()
    assert (
        player.get("/api/progress/recovery", headers={"X-Profile-ID": str(another["id"])}).json()
        == []
    )
    assert player.post("/api/progress/snake/complete", json=data).status_code == 200
    assert player.get("/api/progress/recovery").json() == []


def test_backup_restores_copies_and_rejects_unknown_games_atomically(player, profile):
    player.post("/api/progress/snake/complete", json=payload())
    player.post(
        "/api/saves/snake", json={"slot": 1, "data": {"format": 1, "state": {"score": 100}}}
    )
    backup = player.get("/api/data/export")
    assert backup.status_code == 200, backup.text
    restored = player.post("/api/data/import", json=backup.json())
    assert restored.status_code == 200, restored.text
    new_id = restored.json()["profile_map"][str(profile["id"])]
    headers = {"X-Profile-ID": str(new_id)}
    assert player.get("/api/stats/snake", headers=headers).json()["high_score"] == 100
    assert player.get("/api/saves/snake", headers=headers).json()["total"] == 1
    assert player.get("/api/achievements/snake", headers=headers).json()["unlocked_count"] == 3
    assert player.get("/api/progress/history", headers=headers).json()["total"] == 1
    broken = backup.json()
    broken["profiles"][0]["games"][0]["slug"] = "missing-game"
    assert player.post("/api/data/import", json=broken).status_code == 422
    assert len(player.get("/api/profiles").json()["profiles"]) == 2


def test_history_paginates_with_total(player):
    for _ in range(3):
        player.post("/api/progress/snake/complete", json=payload())
    page = player.get("/api/progress/history?limit=2&skip=2").json()
    assert page["total"] == 3
    assert len(page["sessions"]) == 1


def test_concurrent_completion_retries_commit_once(player):
    from concurrent.futures import ThreadPoolExecutor

    data = payload()
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(
            pool.map(lambda _: player.post("/api/progress/snake/complete", json=data), range(4))
        )
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == responses[0].json() for response in responses)
    assert player.get("/api/stats/snake").json()["total_playtime_seconds"] == 20
    assert player.get("/api/progress/history").json()["total"] == 1


def test_restored_queued_completion_does_not_duplicate_time(player, profile):
    data = payload()
    player.post("/api/progress/snake/complete", json=data)
    backup = player.get("/api/data/export").json()
    restored = player.post("/api/data/import", json=backup).json()
    headers = {"X-Profile-ID": str(restored["profile_map"][str(profile["id"])])}
    replay = {**data, "session_id": restored["session_map"][data["session_id"]]}
    assert (
        player.post("/api/progress/snake/complete", headers=headers, json=replay).status_code == 200
    )
    assert player.get("/api/stats/snake", headers=headers).json()["total_playtime_seconds"] == 20
    assert player.get("/api/progress/history", headers=headers).json()["total"] == 1


def test_production_static_routes_keep_api_errors_and_serve_deep_links(settings, tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app

    frontend = tmp_path / "dist"
    frontend.mkdir()
    (frontend / "index.html").write_text("<html>Console</html>")
    (frontend / "asset.js").write_text('console.log("local")')
    settings.FRONTEND_DIR = frontend
    with TestClient(create_app(settings)) as client:
        assert client.get("/").text == "<html>Console</html>"
        assert client.get("/play/snake").text == "<html>Console</html>"
        assert client.get("/asset.js").status_code == 200
        assert client.get("/missing.js").status_code == 404
        assert client.get("/api/missing").status_code == 404
        assert client.get("/api/missing").headers["content-type"] == "application/json"


def test_duplicate_import_entries_are_rejected_without_creating_players(player):
    player.post("/api/progress/snake/complete", json=payload())
    backup = player.get("/api/data/export").json()
    records = backup["profiles"][0]["games"][0]["records"]
    records.append(records[0])
    assert player.post("/api/data/import", json=backup).status_code == 422
    assert len(player.get("/api/profiles").json()["profiles"]) == 1


def test_endless_flight_accepts_upgraded_speed_and_exploration_metrics(player):
    from uuid import uuid4

    result = player.post(
        "/api/progress/stellar-flight/complete",
        json={
            "session_id": str(uuid4()),
            "playtime_seconds": 600,
            "score": 12000,
            "mode": "endless",
            "rules_version": 3,
            "metrics": {"max_speed": 1000, "sectors": 12, "gates": 25, "crashed": False},
        },
    )
    assert result.status_code == 200
    achievements = player.get("/api/achievements/stellar-flight").json()["achievements"]
    assert next(a for a in achievements if a["slug"] == "clean-course")["unlocked"]
    assert next(a for a in achievements if a["slug"] == "course-complete")["unlocked"]


def test_sprint_times_rank_completed_runs_and_survive_backup(player, profile):
    def finish(ms, score=100, completed=True, **changes):
        data = {
            **payload(),
            "mode": "sprint",
            "rules_version": 2,
            "score": score,
            "metrics": {"completed": completed, "elapsed_ms": ms},
            **changes,
        }
        response = player.post("/api/progress/tetris/complete", json=data)
        assert response.status_code == 200, response.text
        assert player.post("/api/progress/tetris/complete", json=data).json() == response.json()
        return response.json()

    assert finish(90000)["is_new_best_time"] is True
    slower = finish(120000, score=9000)
    assert slower["best_time_ms"] == 90000
    assert slower["is_new_best_time"] is False
    assert finish(1000, completed=False)["best_time_ms"] == 90000
    faster = finish(85321, score=200)
    assert faster["best_time_ms"] == 85321
    assert faster["previous_best_time_ms"] == 90000
    assert faster["is_new_best_time"] is True
    assert finish(100, rules_version=1)["best_time_ms"] is None
    assert finish(1000, difficulty="hard")["best_time_ms"] == 1000
    another = player.post("/api/profiles", json={"username": "Sprinter"}).json()
    assert (
        player.get("/api/progress/records", headers={"X-Profile-ID": str(another["id"])}).json()
        == []
    )
    rows = player.get("/api/progress/records").json()
    normal = next(r for r in rows if r["rules_version"] == 2 and r["difficulty"] == "normal")
    assert normal["best_time_ms"] == 85321
    assert normal["high_score"] == 9000
    backup = player.get("/api/data/export").json()
    response = player.post("/api/data/import", json=backup)
    assert response.status_code == 200, response.text
    headers = {"X-Profile-ID": str(response.json()["profile_map"][str(profile["id"])])}
    restored = player.get("/api/progress/records", headers=headers).json()
    assert (
        next(r for r in restored if r["rules_version"] == 2 and r["difficulty"] == "normal")[
            "best_time_ms"
        ]
        == 85321
    )


def test_sprint_default_difficulty_shares_the_normal_record(player):
    for difficulty, ms in [(None, 90000), ("normal", 120000)]:
        data = {
            **payload(),
            "mode": "sprint",
            "rules_version": 2,
            "difficulty": difficulty,
            "metrics": {"completed": True, "elapsed_ms": ms},
        }
        response = player.post("/api/progress/tetris/complete", json=data)
        assert response.status_code == 200, response.text
        assert response.json()["best_time_ms"] == 90000
    assert player.get("/api/progress/records").json()[0]["best_time_ms"] == 90000


def test_receipts_from_before_elapsed_metric_remain_replayable(player, settings):
    import json
    import sqlite3

    data = payload()
    original = player.post("/api/progress/snake/complete", json=data).json()
    with sqlite3.connect(settings.DATABASE_URL.removeprefix("sqlite+aiosqlite:///")) as db:
        saved = json.loads(
            db.execute(
                "SELECT completion FROM game_sessions WHERE session_id=?", (data["session_id"],)
            ).fetchone()[0]
        )
        saved["payload"]["metrics"].pop("elapsed_ms")
        db.execute(
            "UPDATE game_sessions SET completion=? WHERE session_id=?",
            (json.dumps(saved), data["session_id"]),
        )
    replay = player.post("/api/progress/snake/complete", json=data)
    assert replay.status_code == 200, replay.text
    assert replay.json() == original
    assert player.get("/api/stats/snake").json()["sessions_count"] == 1
