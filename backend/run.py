"""Run the local API; use --reload explicitly during development."""

import argparse
import logging

import uvicorn

from app.config import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Arcade Nexus local API")
    parser.add_argument("--reload", action="store_true", help="Reload changed backend files")
    arguments = parser.parse_args()
    settings = get_settings()
    logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=arguments.reload,
        log_level="debug" if settings.DEBUG else "info",
    )


if __name__ == "__main__":
    main()
