"""Profile selection, validation, deletion, and concurrent updates."""

import asyncio

import httpx2 as httpx
import pytest


@pytest.mark.parametrize("username", ["", "   ", "x" * 51, "name\nline", "\x00name"])
def test_invalid_usernames(client, username):
    assert client.post("/api/profiles", json={"username": username}).status_code == 422


def test_username_normalization_and_avatar_clearing(client):
    profile = client.post("/api/profiles", json={"username": "  Alice  ", "avatar": "🎮"}).json()
    assert profile["username"] == "Alice"
    assert profile["created_at"].endswith("Z")
    assert profile["is_default"]
    assert client.post("/api/profiles", json={"username": "Alice"}).status_code == 400
    updated = client.put(f"/api/profiles/{profile['id']}", json={"avatar": None}).json()
    assert updated["avatar"] is None
    assert updated["username"] == "Alice"


def test_profile_selection_deletion_and_reserved_names(player, profile):
    other = player.post("/api/profiles", json={"username": "Other"}).json()
    third = player.post("/api/profiles", json={"username": "Third"}).json()
    assert not other["is_default"]
    assert player.post(f"/api/profiles/{third['id']}/activate").status_code == 200
    assert player.get("/api/profiles/active").json()["id"] == third["id"]
    assert player.delete(f"/api/profiles/{third['id']}").status_code == 204
    assert player.get("/api/profiles/active").json()["id"] == profile["id"]
    assert player.get(f"/api/profiles/{third['id']}").status_code == 404
    assert player.post(f"/api/profiles/{third['id']}/activate").status_code == 404
    assert player.post("/api/profiles", json={"username": "Third"}).status_code == 400


def test_deleting_all_profiles_does_not_resurrect_a_player(player, profile):
    assert player.delete(f"/api/profiles/{profile['id']}").status_code == 204
    assert player.get("/api/stats").status_code == 409
    assert player.get("/api/profiles/active").json() is None
    assert player.get("/api/profiles").json()["profiles"] == []
    new = player.post("/api/profiles", json={"username": "Fresh"}).json()
    assert new["is_default"]


def test_duplicate_rename_rolls_back_and_leaves_database_usable(player, profile):
    other = player.post("/api/profiles", json={"username": "Other"}).json()
    route = f"/api/profiles/{other['id']}"
    assert player.put(route, json={"username": profile["username"]}).status_code == 400
    assert player.put(route, json={"username": "Renamed"}).json()["username"] == "Renamed"


def test_concurrent_creation_and_activation(client):
    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=client.app), base_url="http://testserver"
        ) as connection:
            created = await asyncio.gather(
                *[
                    connection.post("/api/profiles", json={"username": f"Player {index}"})
                    for index in range(4)
                ]
            )
            assert all(response.status_code == 201 for response in created)
            duplicate = await asyncio.gather(
                *[connection.post("/api/profiles", json={"username": "Same"}) for _ in range(2)]
            )
            assert sorted(response.status_code for response in duplicate) == [201, 400]
            activated = await asyncio.gather(
                *[
                    connection.post(f"/api/profiles/{response.json()['id']}/activate")
                    for response in created
                ]
            )
            assert all(response.status_code == 200 for response in activated)

    client.portal.call(requests)
    profiles = client.get("/api/profiles").json()["profiles"]
    assert sum(profile["is_default"] for profile in profiles) == 1
