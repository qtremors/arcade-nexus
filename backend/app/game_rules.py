"""Ranking semantics shared with the frontend catalog, including historical rules."""

import json
from pathlib import Path

CATALOG = json.loads((Path(__file__).resolve().parents[2] / "catalog.json").read_text())


def time_ranked(slug: str, mode: str, rules: int) -> bool:
    return any(
        m["id"] == mode and m.get("ranking") == "time" and rules >= m.get("rankingSince", 1)
        for m in CATALOG.get(slug, {}).get("modes", [])
    )
