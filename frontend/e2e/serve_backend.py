"""Start a real backend against an ephemeral database for browser tests."""

import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path


def stop(signum, frame):
    raise SystemExit(0)


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
backend = Path(__file__).resolve().parents[2] / "backend"
with tempfile.TemporaryDirectory(prefix="arcade-browser-") as directory:
    env = dict(os.environ, PORT="8011", DATABASE_URL=f"sqlite+aiosqlite:///{directory}/test.db")
    child = subprocess.Popen([sys.executable, str(backend / "run.py")], cwd=backend, env=env)
    try:
        child.wait()
    finally:
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
