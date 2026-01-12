from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_session_logic():
    # 1. Start a session
    # We use 'snake' slug which is seeded by default
    response = client.post("/api/stats/snake/start")
    assert response.status_code == 200
    data = response.json()
    assert "sessions_count" in data
    initial_count = data["sessions_count"]

    # 2. Record playtime (should NOT increment sessions_count)
    response = client.post("/api/stats/snake/session", json={"playtime_seconds": 10})
    assert response.status_code == 200
    
    # 3. Check stats
    response = client.get("/api/stats/snake")
    assert response.status_code == 200
    data = response.json()
    assert data["sessions_count"] == initial_count
    assert data["total_playtime_seconds"] >= 10

    # 4. Start another session
    response = client.post("/api/stats/snake/start")
    assert response.status_code == 200
    assert response.json()["sessions_count"] == initial_count + 1
