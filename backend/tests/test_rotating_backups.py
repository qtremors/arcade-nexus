"""Rotated snapshots remain portable, validated and independent of live players."""

from pathlib import Path


def test_preview_validates_without_creating_players(client, profile):
    backup = client.get("/api/data/export").json()
    before = client.get("/api/profiles").json()
    response = client.post("/api/data/preview", json=backup)
    assert response.status_code == 200, response.text
    assert response.json()["profile_ids"] == [profile["id"]]
    assert response.json()["names"] == [profile["username"]]
    assert client.get("/api/profiles").json() == before
    backup["profiles"].append(backup["profiles"][0])
    assert client.post("/api/data/preview", json=backup).status_code == 422
    assert client.get("/api/profiles").json() == before


def test_rotated_copies_download_and_restore_as_new_players(client, profile, app):
    manager = app.state.backups
    manager.retention = 2
    manager.directory.mkdir(parents=True, exist_ok=True)
    unrelated = manager.directory / "my-export.json"
    unrelated.write_text("keep me", encoding="utf-8")
    names = []
    for _ in range(3):
        response = client.post("/api/data/backups")
        assert response.status_code == 200, response.text
        names.append(response.json()["name"])
    status = client.get("/api/data/backups").json()
    assert status["enabled"] and status["retention"] == 2
    assert len(status["backups"]) == 2
    assert {item["name"] for item in status["backups"]} == set(names[1:])
    assert unrelated.read_text() == "keep me"
    assert client.get(f"/api/data/backups/{names[0]}").status_code == 404
    downloaded = client.get(f"/api/data/backups/{names[-1]}")
    assert downloaded.json()["format"] == "arcade-nexus-backup-1"
    assert downloaded.json()["browser"] == {}
    assert downloaded.headers["cache-control"] == "no-store"
    assert client.post(f"/api/data/backups/{names[-1]}/preview").json()["profiles"] == 1
    restored = client.post(f"/api/data/backups/{names[-1]}/restore")
    assert restored.status_code == 200, restored.text
    assert restored.json()["imported"] == 1
    players = client.get("/api/profiles").json()["profiles"]
    assert len(players) == 2
    assert any(
        player["id"] == profile["id"] and player["username"] == profile["username"]
        for player in players
    )


def test_failed_atomic_write_keeps_previous_snapshot_and_removes_temporary_file(
    client, profile, app, monkeypatch
):
    snapshot = client.post("/api/data/backups").json()
    path = app.state.backups.path(snapshot["name"])
    content = path.read_bytes()

    def fail_replace(*_args, **_kwargs):
        raise OSError("Disk full")

    monkeypatch.setattr(Path, "replace", fail_replace)
    response = client.post("/api/data/backups")
    assert response.status_code == 503
    assert "free disk space" in response.json()["detail"]
    assert path.read_bytes() == content
    assert not list(path.parent.glob(".snapshot-*.tmp"))
    assert client.get("/api/data/backups").json()["error"]


def test_scheduled_backup_reuses_recent_snapshots_and_creates_a_copy_when_due(
    client, profile, settings, app, monkeypatch
):
    from datetime import timedelta

    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.services import backups

    first = client.post("/api/data/backups").json()
    with TestClient(create_app(settings)) as restarted:
        assert [item["name"] for item in restarted.get("/api/data/backups").json()["backups"]] == [
            first["name"]
        ]
    later = backups.utc_now() + timedelta(hours=25)
    monkeypatch.setattr(backups, "utc_now", lambda: later)
    with TestClient(create_app(settings)) as restarted:
        snapshots = restarted.get("/api/data/backups").json()["backups"]
        assert len(snapshots) == 2
        assert snapshots[0]["reason"] == "daily"
        assert (
            restarted.get(f"/api/data/backups/{snapshots[0]['name']}").json()["database"][
                "profiles"
            ][0]["original_id"]
            == profile["id"]
        )


def test_snapshot_download_rejects_unowned_names_and_symlinks(client, profile, app, tmp_path):
    snapshot = client.post("/api/data/backups").json()
    path = app.state.backups.path(snapshot["name"])
    path.unlink()
    unrelated = tmp_path / "private.json"
    unrelated.write_text("private", encoding="utf-8")
    path.symlink_to(unrelated)
    assert client.get(f"/api/data/backups/{snapshot['name']}").status_code == 404
    assert client.get("/api/data/backups/private.json").status_code == 404
    assert client.get("/api/data/backups").json()["backups"] == []


def test_stored_backup_rejects_malformed_wrappers_without_writes(client, profile, app):
    import json

    snapshot = client.post("/api/data/backups").json()
    path = app.state.backups.path(snapshot["name"])
    valid = json.loads(path.read_text())
    before = client.get("/api/profiles").json()
    for invalid in ([], None, "backup", 42, {}, {**valid, "format": "future-backup-2"}):
        path.write_text(json.dumps(invalid), encoding="utf-8")
        for action in ("preview", "restore"):
            response = client.post(f"/api/data/backups/{path.name}/{action}")
            assert response.status_code == 422, response.text
        assert client.get("/api/profiles").json() == before


def test_clock_rollback_keeps_fresh_manual_and_scheduled_snapshots(
    client, profile, app, monkeypatch
):
    from datetime import timedelta

    from app.services import backups

    manager = app.state.backups
    manager.retention = 1
    now = backups.utc_now()
    monkeypatch.setattr(backups, "utc_now", lambda: now + timedelta(days=365))
    future = client.post("/api/data/backups").json()
    monkeypatch.setattr(backups, "utc_now", lambda: now)
    manual = client.post("/api/data/backups")
    assert manual.status_code == 200, manual.text
    assert manager.path(manual.json()["name"]) is not None
    assert manager.path(future["name"]) is None
    monkeypatch.setattr(backups, "utc_now", lambda: now + timedelta(days=365))
    client.post("/api/data/backups")
    monkeypatch.setattr(backups, "utc_now", lambda: now)
    scheduled = client.portal.call(manager.create)
    assert scheduled and scheduled["reason"] == "daily"
    assert manager.path(scheduled["name"]) is not None
    assert client.portal.call(manager.create) is None
    monkeypatch.setattr(backups, "utc_now", lambda: now + timedelta(hours=25))
    assert client.portal.call(manager.create) is not None
