"""Application startup, readiness, request protection, and API contracts."""

import httpx2 as httpx
import pytest

from app.main import create_app


def test_startup_seeds_without_creating_a_profile(client):
    assert client.get("/").json()["status"] == "running"
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/api/games").json()["total"] == 5
    assert client.get("/api/profiles").json() == {"profiles": [], "active_id": None}
    assert client.get("/api/stats").status_code == 409
    assert client.get("/api/profiles").json()["profiles"] == []


def test_openapi_exposes_typed_sessions_and_profile_scoping(client):
    schema = client.get("/openapi.json").json()
    history = schema["paths"]["/api/stats/sessions"]["get"]
    assert history["responses"]["200"]["content"]["application/json"]["schema"]["items"][
        "$ref"
    ].endswith("/SessionResponse")
    assert any(item["name"] == "X-Profile-ID" for item in history["parameters"])


def test_untrusted_host_is_rejected(client):
    assert client.get("/health", headers={"Host": "attacker.example"}).status_code == 400


def test_mutations_reject_untrusted_browser_origins(client):
    response = client.post(
        "/api/profiles",
        json={"username": "Intruder"},
        headers={"Origin": "https://attacker.example"},
    )
    assert response.status_code == 403
    assert client.get("/api/profiles").json()["profiles"] == []


def test_cors_allows_profile_header(client):
    response = client.options(
        "/api/stats",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Profile-ID",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_body_limit_before_json_parsing(client):
    response = client.post("/api/profiles", content=b"x" * (1024 * 1024 + 1))
    assert response.status_code == 413


def test_body_limit_for_streamed_requests(client):
    async def chunks():
        yield b"x" * 600000
        yield b"x" * 600000

    async def request():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=client.app), base_url="http://testserver"
        ) as connection:
            return await connection.post("/api/profiles", content=chunks())

    assert client.portal.call(request).status_code == 413


@pytest.mark.parametrize(
    "route", ["/api/stats", "/api/library", "/api/saves/snake", "/api/achievements"]
)
def test_invalid_explicit_profile_never_falls_back(player, route):
    assert player.get(route, headers={"X-Profile-ID": "999"}).status_code == 404
    assert player.get(route, headers={"X-Profile-ID": "0"}).status_code == 422


def test_restart_preserves_progress(settings):
    from fastapi.testclient import TestClient

    with TestClient(create_app(settings)) as first:
        first.post("/api/profiles", json={"username": "Persistent"})
        first.post("/api/saves/snake", json={"slot": 1, "data": {"score": 45}})
        first.post("/api/stats/snake/score", json={"score": 45})
    with TestClient(create_app(settings)) as second:
        assert second.get("/api/saves/snake").json()["saves"][0]["data"] == {"score": 45}
        assert second.get("/api/stats/snake").json()["high_score"] == 45
