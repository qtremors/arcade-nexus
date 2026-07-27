"""Wire and simulation bounds shared with the browser, without network generation."""

import json
from pathlib import Path

LIMITS = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts/gameplay-limits.json").read_text()
)
