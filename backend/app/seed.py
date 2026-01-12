"""
Database Seed Script - Populate initial games
"""
import asyncio
from app.database import AsyncSessionLocal, init_db
from app.models.game import Game, Category
from app.models.achievement import Achievement

# Local SVG thumbnails
GAME_ASSETS = {
    "snake": "/games/snake.svg",
    "raptor": "/games/raptor.svg",
    "jet": "/games/aether-flight.svg"
}

INITIAL_GAMES = [
    {
        "slug": "snake",
        "title": "Neon Snake",
        "description": "Classic snake game with a cyberpunk twist. Consume data packets to grow longer!",
        "category": Category.ARCADE,
        "thumbnail": GAME_ASSETS["snake"],
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
        "thumbnail": GAME_ASSETS["raptor"],
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
        "slug": "aether-flight",
        "title": "Aether Flight",
        "description": "Piloting advanced aircraft across multiple atmospheres. Master 6-DOF flight controls in this high-fidelity simulation.",
        "category": Category.SIMULATION,
        "thumbnail": GAME_ASSETS["jet"],
        "config": {
            "model_path": "/models/Jet.glb",
            "initial_speed": 50,
        },
        "achievements": [
            {"slug": "mach-1", "title": "Supersonic", "description": "Reach speed of 340 units"},
            {"slug": "orbit", "title": "Sub-orbital", "description": "Reach altitude of 5000 units"},
            {"slug": "ace", "title": "Ace Pilot", "description": "Complete a flight of 10 minutes without crashing"},
        ]
    }
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
