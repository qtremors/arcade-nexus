"""Run a local Full HD diagnostic on the selected laptop, without touching player data."""

import argparse
import os
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", default="12th-generation Intel i7, integrated graphics")
    parser.add_argument("--power", choices=["ac", "battery", "unknown"], default="unknown")
    parser.add_argument("--seconds", type=float, default=60)
    parser.add_argument(
        "--games",
        default="snake,raptor-run,breakout,merge-2048,tetris,asteroids,prism-rush,stellar-flight",
    )
    parser.add_argument("--all-modes", action="store_true")
    parser.add_argument("--cycles", type=int, default=10)
    parser.add_argument("--browser", choices=["chrome", "msedge", "chromium"], default="chrome")
    parser.add_argument(
        "--software",
        action="store_true",
        help="Headless software diagnostic; cannot validate laptop GPU performance",
    )
    parser.add_argument("--output", type=Path, default=ROOT / "laptop-performance.json")
    args = parser.parse_args()
    if not 0 < args.seconds <= 3600 or not 0 <= args.cycles <= 100:
        parser.error("seconds must be in (0, 3600] and cycles in [0, 100]")
    node = shutil.which("node")
    if not node or not (ROOT / "frontend/node_modules").is_dir():
        parser.error(
            "Run python arcade.py --setup first; Node and frontend dependencies are required"
        )
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    environment = dict(
        os.environ,
        BENCH_URL=url,
        BENCH_OUTPUT=str(args.output.resolve()),
        BENCH_WIDE="1",
        BENCH_WARMUP_SECONDS="5",
        BENCH_SAMPLE_SECONDS=str(args.seconds),
        BENCH_GAMES=args.games,
        BENCH_STRESS="1",
        BENCH_REENTRY_CYCLES=str(args.cycles),
        BENCH_LABEL=args.label,
        BENCH_POWER=args.power,
        HEADFUL="0" if args.software else "1",
        SOFTWARE_GPU="1" if args.software else "0",
    )
    environment["BENCH_MODES"] = "all" if args.all_modes else "first"
    if not args.software and not environment.get("CHROMIUM_PATH"):
        if args.browser != "chromium":
            environment["BROWSER_CHANNEL"] = args.browser
    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    print(
        "Full HD / full detail / 60 FPS target. Close other heavy apps and keep the browser visible.",
        flush=True,
    )
    print(
        "This uses isolated game instances, without reading or writing your player database.",
        flush=True,
    )
    server = subprocess.Popen(
        [
            node,
            str(ROOT / "frontend/node_modules/vite/bin/vite.js"),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--strictPort",
        ],
        cwd=ROOT / "frontend",
        env=environment,
        stdout=subprocess.DEVNULL,
    )
    try:
        deadline = time.monotonic() + 30
        while True:
            if server.poll() is not None:
                raise SystemExit("The local diagnostic server could not start")
            try:
                with urllib.request.urlopen(url, timeout=1):
                    break
            except (urllib.error.URLError, TimeoutError):
                if time.monotonic() >= deadline:
                    raise SystemExit("Timed out starting the local diagnostic server")
                time.sleep(0.1)
        result = subprocess.run(
            [node, "scripts/benchmark-games.mjs"], cwd=ROOT / "frontend", env=environment
        )
        if result.returncode:
            raise SystemExit(result.returncode)
        print(f"Report saved to {args.output.resolve()}", flush=True)
        print(
            "Review GPU identity, frame pacing, resets and entry/exit memory trends. Follow docs/PLAYTEST.md for full acceptance."
        )
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()


if __name__ == "__main__":
    main()
