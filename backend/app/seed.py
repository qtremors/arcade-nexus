"""
Database Seed Script - Populate initial games
"""
import asyncio
from app.database import AsyncSessionLocal, init_db
from app.models.game import Game, Category
from app.models.achievement import Achievement

# SVG thumbnails as data URIs
SNAKE_THUMBNAIL = "https://api.iconify.design/game-icons:snake.svg?color=%2300ff88&width=256&height=256"
RAPTOR_THUMBNAIL = "https://api.iconify.design/game-icons:velociraptor.svg?color=%23ff7675&width=256&height=256"
SPACE_THUMBNAIL = "https://api.iconify.design/game-icons:rocket.svg?color=%2300d4ff&width=256&height=256"

INITIAL_GAMES = [
    {
        "slug": "snake",
        "title": "Neon Snake",
        "description": "Classic snake game with a cyberpunk twist. Consume data packets to grow longer!",
        "category": Category.ARCADE,
        "thumbnail": SNAKE_THUMBNAIL,
        "config": {
            "grid_size": 20,
            "initial_speed": 120,
        },
        "achievements": [
            {"slug": "first-bite", "title": "First Byte", "description": "Eat your first data packet"},
            {"slug": "score-50", "title": "Data Hoarder", "description": "Score 50 points"},
            {"slug": "score-100", "title": "Megabyte", "description": "Score 100 points"},
            {"slug": "score-200", "title": "Gigabyte", "description": "Score 200 points"},
        ]
    },
    {
        "slug": "raptor-run",
        "title": "Raptor Run",
        "description": "Run, jump, and dodge obstacles in this prehistoric endless runner!",
        "category": Category.ACTION,
        "thumbnail": RAPTOR_THUMBNAIL,
        "config": {
            "gravity": 1500,
            "jump_force": 600,
            "initial_speed": 400,
        },
        "achievements": [
            {"slug": "first-jump", "title": "Liftoff", "description": "Make your first jump"},
            {"slug": "score-500", "title": "Survivor", "description": "Score 500 points"},
            {"slug": "score-1000", "title": "Apex Predator", "description": "Score 1000 points"},
            {"slug": "score-2500", "title": "Extinction Event", "description": "Score 2500 points"},
        ]
    },
    {
        "slug": "space-runner",
        "title": "Stellar Drift",
        "description": "Navigate through asteroid fields in this endless space adventure!",
        "category": Category.ACTION,
        "thumbnail": SPACE_THUMBNAIL,
        "config": {
            "ship_speed": 300,
            "asteroid_spawn_rate": 1.5,
        },
        "achievements": [
            {"slug": "first-dodge", "title": "Close Call", "description": "Dodge your first asteroid"},
            {"slug": "score-500", "title": "Space Cadet", "description": "Score 500 points"},
            {"slug": "score-1000", "title": "Star Pilot", "description": "Score 1000 points"},
            {"slug": "score-2500", "title": "Galaxy Commander", "description": "Score 2500 points"},
        ]
    },
]


async def seed_games(skip_init: bool = False):
    """Seed the database with initial games."""
    if not skip_init:
        await init_db()
    
    async with AsyncSessionLocal() as db:
        for game_data in INITIAL_GAMES:
            achievements = game_data.pop("achievements", [])
            
            from sqlalchemy import select
            result = await db.execute(
                select(Game).where(Game.slug == game_data["slug"])
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"Game '{game_data['slug']}' already exists, skipping...")
                continue
            
            game = Game(**game_data)
            db.add(game)
            await db.flush()
            
            for ach_data in achievements:
                achievement = Achievement(
                    game_id=game.id,
                    **ach_data
                )
                db.add(achievement)
            
            print(f"Created game: {game_data['title']} with {len(achievements)} achievements")
        
        await db.commit()
        print("\n✅ Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed_games())
