"""One-command local console. Uses only Python's standard library to launch."""

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def executable(name):
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"Install {name} and add it to PATH before continuing.")
    return path


def main():
    parser = argparse.ArgumentParser(description="Launch Arcade Nexus in your browser")
    parser.add_argument(
        "--setup",
        action="store_true",
        help="Install locked dependencies and build (Internet required)",
    )
    parser.add_argument(
        "--dev", action="store_true", help="Run both development servers with reload"
    )
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser")
    args = parser.parse_args()
    children = []
    try:
        uv = executable("uv")
        if args.setup:
            npm = executable("npm")
            subprocess.run([uv, "sync", "--locked"], cwd=ROOT / "backend", check=True)
            subprocess.run([npm, "ci"], cwd=ROOT / "frontend", check=True)
            subprocess.run([npm, "run", "build"], cwd=ROOT / "frontend", check=True)
        if not (ROOT / "backend/.venv").is_dir() or (
            not args.dev and not (ROOT / "frontend/dist/index.html").is_file()
        ):
            raise RuntimeError("First run: python arcade.py --setup. Later launches work offline.")
        ports = [8000, 5173] if args.dev else [8000]
        for port in ports:
            with socket.socket() as probe:
                try:
                    probe.bind(("127.0.0.1", port))
                except OSError:
                    raise RuntimeError(
                        f"Port {port} is occupied. Close the existing console/server and retry; the console address stays stable."
                    ) from None
        env = dict(os.environ, HOST="127.0.0.1", PORT="8000")
        if args.dev:
            env.pop("FRONTEND_DIR", None)
        else:
            env["FRONTEND_DIR"] = str(ROOT / "frontend/dist")
        command = [uv, "run", "--no-sync", "python", "run.py"]
        if args.dev:
            command.append("--reload")
        children.append(subprocess.Popen(command, cwd=ROOT / "backend", env=env))
        url = "http://127.0.0.1:8000"
        if args.dev:
            children.append(
                subprocess.Popen(
                    [executable("npm"), "run", "dev", "--", "--port", "5173", "--strictPort"],
                    cwd=ROOT / "frontend",
                    env=env,
                )
            )
            url = "http://127.0.0.1:5173"
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if any(child.poll() is not None for child in children):
                raise RuntimeError("A console process exited during startup. See the error above.")
            try:
                with opener.open("http://127.0.0.1:8000/health", timeout=1) as response:
                    healthy = json.load(response).get("status") == "healthy"
                with opener.open(url, timeout=1) as response:
                    ready = response.status == 200
                if healthy and ready:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.2)
        else:
            raise RuntimeError("Console did not become ready within 40 seconds.")
        print(f"\nArcade Nexus is ready: {url}\nPress Ctrl+C to close the console.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        while all(child.poll() is None for child in children):
            time.sleep(0.5)
        raise RuntimeError(
            "A console process stopped unexpectedly. See the log above and relaunch."
        )
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Arcade Nexus: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        pass
    finally:
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
    return 0


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    sys.exit(main())
