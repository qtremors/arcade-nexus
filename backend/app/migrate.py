"""Upgrade a database without starting the HTTP server."""

import asyncio

from app.database import engine, init_db


async def main() -> None:
    try:
        await init_db()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
