"""Explicit local checks only; no hosted automation or deployment."""

import argparse
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--browser", action="store_true", help="Include isolated Playwright journeys"
    )
    args = parser.parse_args()
    checks = [
        ("backend", ["uv", "run", "python", "../scripts/boundaries.py"]),
        ("backend", ["uv", "run", "python", "../scripts/contracts.py", "--check"]),
        ("frontend", ["node", "scripts/check-boundaries.mjs"]),
        ("backend", ["uv", "run", "ruff", "check", ".", "../arcade.py", "../scripts"]),
        ("backend", ["uv", "run", "pytest", "-q"]),
        ("frontend", ["npm", "run", "lint"]),
        ("frontend", ["npm", "run", "test:unit"]),
        ("frontend", ["npm", "run", "build"]),
    ]
    if args.browser:
        checks.append(("frontend", ["npm", "run", "test:e2e"]))
    for directory, command in checks:
        executable = shutil.which(command[0])
        if not executable:
            raise SystemExit(f"Install {command[0]} first; see README.md")
        print(f"\n{directory}: {' '.join(command)}", flush=True)
        result = subprocess.run([executable, *command[1:]], cwd=ROOT / directory)
        if result.returncode:
            raise SystemExit(result.returncode)
    print("All requested local checks passed.")


if __name__ == "__main__":
    main()
