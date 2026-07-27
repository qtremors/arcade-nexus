"""Read the application version from the repository's shared metadata."""

import json
from pathlib import Path

_metadata = json.loads((Path(__file__).resolve().parents[2] / "version.json").read_text())
VERSION: str = _metadata["version"]
VERSION_CODE: int = _metadata["code"]
