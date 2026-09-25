"""Check the ownership boundaries introduced by the review follow-up."""

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    failures = []
    for path in (ROOT / "backend/app/services").glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith(
                "app.routers"
            ):
                failures.append(f"{path.relative_to(ROOT)} imports an HTTP router")
    pure = list((ROOT / "frontend/src/games").glob("*/codec.ts"))
    pure += list((ROOT / "frontend/src/games").glob("*/*Simulation.ts"))
    pure += list((ROOT / "frontend/src/sdk").glob("*.ts"))
    # Existing browser-specific SDK adapters own DOM access; no SDK file owns app storage.
    for path in pure:
        imports = re.findall(
            r'(?:from\s+|import\s*)["\']([^"\']+)["\']', path.read_text()
        )
        if any(
            "/shared/" in value or "/features/" in value or value == "react"
            for value in imports
        ):
            failures.append(f"{path.relative_to(ROOT)} imports application state")
    for path in (ROOT / "frontend/src/features/session/components").glob("*.tsx"):
        if "savesApi" in path.read_text() or "engine.current" in path.read_text():
            failures.append(f"{path.relative_to(ROOT)} bypasses session commands")
    benchmark = (ROOT / "frontend/scripts/benchmark-games.mjs").read_text()
    if re.search(
        r"engine\.(?:input|samples)\b|game\.(?:renderer|run|snake|obstacles|paddle|ball)\b",
        benchmark,
    ):
        failures.append("Game benchmark accesses a private field")
    if failures:
        raise SystemExit("\n".join(failures))
    print("Backend, SDK, codec, view and benchmark ownership checks passed.")


if __name__ == "__main__":
    main()
