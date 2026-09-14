"""Full payload preservation, slot upserts, metadata updates, and isolation."""

import asyncio

import httpx2 as httpx
import pytest


def test_save_roundtrip_upsert_and_metadata_update(player):
    state = {"score": 25, "snake": [{"x": 2, "y": 4}], "food": {"x": 5, "y": 6}}
    first = player.post(
        "/api/saves/snake",
        json={
            "slot": 1,
            "name": "Checkpoint",
            "thumbnail": "data:image/png;base64,AA==",
            "data": state,
        },
    ).json()
    assert first["data"] == state
    assert first["created_at"].endswith("Z")
    updated = player.put("/api/saves/snake/1", json={"data": {**state, "score": 50}}).json()
    assert updated["id"] == first["id"]
    assert updated["name"] == "Checkpoint"
    assert updated["thumbnail"] == first["thumbnail"]
    assert (
        player.put("/api/saves/snake/1", json={"data": state, "name": None}).json()["name"] is None
    )
    overwritten = player.post("/api/saves/snake", json={"slot": 1, "data": state}).json()
    assert overwritten["id"] == first["id"]
    assert overwritten["created_at"] == first["created_at"]
    assert overwritten["name"] is None
    assert player.get("/api/saves/snake").json()["total"] == 1


@pytest.mark.parametrize("slot", [0, 6, True, 1.5])
def test_invalid_slots(player, slot):
    assert player.post("/api/saves/snake", json={"slot": slot, "data": {}}).status_code == 422


@pytest.mark.parametrize("slot", [0, 6, "invalid"])
def test_invalid_path_slots(player, slot):
    assert player.put(f"/api/saves/snake/{slot}", json={"data": {}}).status_code == 422
    assert player.delete(f"/api/saves/snake/{slot}").status_code == 422


def test_save_limits_use_utf8_bytes_and_reject_nonfinite_json(player):
    assert (
        player.post(
            "/api/saves/snake",
            json={
                "slot": 1,
                "data": {"text": "😀" * 30000},
            },
        ).status_code
        == 422
    )
    response = player.post(
        "/api/saves/snake",
        content='{"slot":1,"data":{"score":NaN}}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert player.get("/api/saves/snake").json()["total"] == 0


def test_save_profile_isolation_and_deletion(player, profile):
    player.post("/api/saves/snake", json={"slot": 1, "data": {"score": 80}})
    other = player.post("/api/profiles", json={"username": "Other"}).json()
    player.post(f"/api/profiles/{other['id']}/activate")
    assert player.get("/api/saves/snake").json()["total"] == 0
    assert player.delete("/api/saves/snake/1").status_code == 404
    header = {"X-Profile-ID": str(profile["id"])}
    assert player.get("/api/saves/snake", headers=header).json()["saves"][0]["data"]["score"] == 80
    assert player.delete("/api/saves/snake/1", headers=header).status_code == 204


def test_concurrent_slot_creation_has_one_row(player):
    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=player.app), base_url="http://testserver"
        ) as connection:
            responses = await asyncio.gather(
                *[
                    connection.post("/api/saves/snake", json={"slot": 1, "data": {"score": score}})
                    for score in range(6)
                ]
            )
            assert all(response.status_code == 201 for response in responses)

    player.portal.call(requests)
    saves = player.get("/api/saves/snake").json()["saves"]
    assert len(saves) == 1
    assert saves[0]["data"]["score"] in range(6)
