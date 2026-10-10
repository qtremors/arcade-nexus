"""Fresh, isolated application instances with the real startup lifecycle."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        DATABASE_URL=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def profile(client):
    response = client.post("/api/profiles", json={"username": "Player", "avatar": "🎮"})
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def player(client, profile):
    return client


@pytest.fixture
def game_ids(client):
    return {game["slug"]: game["id"] for game in client.get("/api/games").json()["games"]}
