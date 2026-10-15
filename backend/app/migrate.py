"""Upgrade a database without starting the HTTP server."""

import asyncio

from app.config import get_settings
from app.database import init_db, make_engine


async def main() -> None:
    settings = get_settings()
    engine = make_engine(settings.DATABASE_URL, debug=settings.DEBUG)
    try:
        await init_db(engine)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
