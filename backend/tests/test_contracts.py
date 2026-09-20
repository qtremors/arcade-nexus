"""Workflow contracts must be usable by the offline browser type generator."""

from app.limits import LIMITS
from app.schemas.stats import CompletionRecord


def test_workflow_openapi_models_and_nullable_history(app):
    document = app.openapi()
    for path, method in (
        ("/api/progress/{slug}/complete", "post"),
        ("/api/progress/records", "get"),
        ("/api/progress/history", "get"),
        ("/api/data/preview", "post"),
        ("/api/data/import", "post"),
    ):
        schema = document["paths"][path][method]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]
        assert "$ref" in schema or schema.get("type") == "array", path
    session = document["components"]["schemas"]["SessionResponse"]
    assert "difficulty" in session["required"]
    assert {part["type"] for part in session["properties"]["difficulty"]["anyOf"]} == {
        "string",
        "null",
    }


def test_wire_bounds_match_shared_gameplay_limits():
    schema = CompletionRecord.model_json_schema()
    assert schema["properties"]["score"]["maximum"] == LIMITS["score"]
    assert schema["properties"]["playtime_seconds"]["maximum"] == LIMITS["playtime_seconds"]
    assert (
        schema["$defs"]["SessionMetrics"]["properties"]["highest_tile"]["anyOf"][0]["maximum"]
        == LIMITS["highest_tile"]
    )


def test_every_json_success_response_has_a_schema(app):
    for path, methods in app.openapi()["paths"].items():
        for method, operation in methods.items():
            if method not in {"get", "post", "put", "delete", "patch"}:
                continue
            for status, response in operation["responses"].items():
                if not status.startswith("2"):
                    continue
                content = response.get("content", {})
                if "application/json" in content:
                    assert content["application/json"].get("schema"), (path, method)
                else:
                    assert status == "204", (path, method, status)


def test_default_factories_follow_configuration_and_keep_households_isolated(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import create_app

    try:
        first_path = tmp_path / "first.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{first_path}")
        get_settings.cache_clear()
        first = create_app()
        assert first.state.engine.url.database == str(first_path)
        second_path = tmp_path / "second.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{second_path}")
        get_settings.cache_clear()
        second = create_app()
        assert second.state.engine.url.database == str(second_path)
        with (
            TestClient(first, base_url="http://127.0.0.1") as one,
            TestClient(second, base_url="http://127.0.0.1") as two,
        ):
            assert (
                one.post("/api/profiles", json={"username": "First household"}).status_code == 201
            )
            assert two.get("/api/profiles").json()["profiles"] == []
            assert len(one.get("/api/profiles").json()["profiles"]) == 1
    finally:
        get_settings.cache_clear()
