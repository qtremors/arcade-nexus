"""History sorting and filters apply to the whole matching history."""

import sqlite3
from datetime import UTC, datetime, timedelta
from uuid import uuid4


def history_rows(settings, profile_id, game_id, count=60):
    with sqlite3.connect(settings.DATABASE_URL.removeprefix("sqlite+aiosqlite:///")) as db:
        rows = []
        for index in range(count):
            stamp = (datetime(2026, 10, 1, tzinfo=UTC) + timedelta(hours=index)).strftime(
                "%Y-%m-%d %H:%M:%S.%f"
            )
            rows.append(
                (
                    str(uuid4()),
                    profile_id,
                    game_id,
                    stamp,
                    stamp,
                    index + 1,
                    index,
                    "hard" if index % 3 == 0 else "normal",
                    "sprint" if index % 2 else "classic",
                    1,
                    "{}",
                )
            )
        db.executemany(
            "INSERT INTO game_sessions (session_id,user_id,game_id,start_time,end_time,duration_seconds,score,difficulty,mode,rules_version,metrics) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )


def test_history_sorts_all_rows_with_stable_pagination(client, profile, settings, game_ids):
    history_rows(settings, profile["id"], game_ids["snake"])
    headers = {"X-Profile-ID": str(profile["id"])}
    first = client.get(
        "/api/progress/history?sort=score&direction=asc&limit=25", headers=headers
    ).json()
    second = client.get(
        "/api/progress/history?sort=score&direction=asc&limit=25&skip=25", headers=headers
    ).json()
    assert first["total"] == second["total"] == 60
    assert [row["score"] for row in first["sessions"]] == list(range(25))
    assert [row["score"] for row in second["sessions"]] == list(range(25, 50))
    descending = client.get(
        "/api/progress/history?sort=duration_seconds&direction=desc", headers=headers
    ).json()
    assert descending["sessions"][0]["score"] == 59
    assert not {row["id"] for row in first["sessions"]} & {row["id"] for row in second["sessions"]}


def test_history_filters_share_the_total_and_respect_profile_boundaries(
    client, profile, settings, game_ids
):
    history_rows(settings, profile["id"], game_ids["snake"])
    history_rows(settings, profile["id"], game_ids["breakout"], 10)
    other = client.post("/api/profiles", json={"username": "Other"}).json()
    history_rows(settings, other["id"], game_ids["snake"])
    headers = {"X-Profile-ID": str(profile["id"])}
    query = {
        "game_id": game_ids["snake"],
        "mode": "sprint",
        "difficulty": "hard",
        "since": "2026-10-01T00:00:00Z",
        "before": "2026-10-02T00:00:00Z",
        "sort": "score",
        "direction": "asc",
        "limit": 2,
    }
    page = client.get("/api/progress/history", params=query, headers=headers).json()
    assert page["total"] == 4
    assert [row["score"] for row in page["sessions"]] == [3, 9]
    page = client.get("/api/progress/history", params={**query, "skip": 2}, headers=headers).json()
    assert [row["score"] for row in page["sessions"]] == [15, 21]
    options = client.get("/api/progress/history/options", headers=headers).json()
    assert {game["slug"] for game in options["games"]} == {"snake", "breakout"}
    assert all(game["modes"] == ["classic", "sprint"] for game in options["games"])


def test_history_validates_sort_and_aware_time_ranges(client, profile):
    headers = {"X-Profile-ID": str(profile["id"])}
    for params in (
        {"sort": "unknown"},
        {"direction": "unknown"},
        {"since": "2026-10-01"},
        {"since": "2026-10-02T00:00:00Z", "before": "2026-10-01T00:00:00Z"},
    ):
        assert (
            client.get("/api/progress/history", params=params, headers=headers).status_code == 422
        )


def test_normal_filter_includes_legacy_null_difficulty(client, profile, settings, game_ids):
    history_rows(settings, profile["id"], game_ids["snake"], 1)
    with sqlite3.connect(settings.DATABASE_URL.removeprefix("sqlite+aiosqlite:///")) as db:
        db.execute("UPDATE game_sessions SET difficulty=NULL")
    page = client.get(
        "/api/progress/history?difficulty=normal", headers={"X-Profile-ID": str(profile["id"])}
    ).json()
    assert page["total"] == len(page["sessions"]) == 1
