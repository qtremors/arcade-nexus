"""
Database Seed Script - Smart Game Sync
Syncs games with code definition while preserving user progress
"""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models.game import Game, Category
from app.models.achievement import Achievement

# Local SVG thumbnails
GAME_ASSETS = {
    "snake": "/games/snake.svg",
    "raptor": "/games/raptor.svg",
    "jet": "/games/stellar-flight.svg"
}

# Master list of games - source of truth
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
        "slug": "stellar-flight",
        "title": "Stellar Flight",
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


async def sync_games(skip_init: bool = False):
    """
    Smart sync: Add new games, update existing, deactivate removed.
    Preserves user progress (saves, stats, achievements_unlocked).
    """
    if not skip_init:
        await init_db()
    
    async with AsyncSessionLocal() as db:
        # Get current slugs from code definition
        code_slugs = {g["slug"] for g in INITIAL_GAMES}
        
        # Get all games from database
        result = await db.execute(select(Game))
        db_games = {g.slug: g for g in result.scalars().all()}
        
        added = 0
        updated = 0
        deactivated = 0
        
        # 1. Add new games and update existing ones
        for game_data in INITIAL_GAMES:
            achievements = game_data.pop("achievements", [])
            slug = game_data["slug"]
            
            if slug in db_games:
                # Update existing game
                existing = db_games[slug]
                existing.title = game_data["title"]
                existing.description = game_data["description"]
                existing.category = game_data["category"]
                existing.thumbnail = game_data["thumbnail"]
                existing.config = game_data["config"]
                existing.is_active = True  # Reactivate if was deactivated
                
                # Sync achievements
                await sync_achievements(db, existing.id, achievements)
                updated += 1
                print(f"📝 Updated: {game_data['title']}")
            else:
                # Add new game
                game = Game(**game_data)
                db.add(game)
                await db.flush()
                
                for ach_data in achievements:
                    achievement = Achievement(game_id=game.id, **ach_data)
                    db.add(achievement)
                
                added += 1
                print(f"✨ Added: {game_data['title']}")
            
            # Restore achievements for next iteration
            game_data["achievements"] = achievements
        
        # 2. Deactivate games not in code (but keep data!)
        for slug, game in db_games.items():
            if slug not in code_slugs and game.is_active:
                game.is_active = False
                deactivated += 1
                print(f"🗄️  Deactivated: {game.title} (data preserved)")
        
        await db.commit()
        print(f"\n✅ Sync complete! Added: {added}, Updated: {updated}, Deactivated: {deactivated}")


async def sync_achievements(db, game_id: int, achievements_data: list):
    """Sync achievements for a game - add new ones, update existing."""
    result = await db.execute(
        select(Achievement).where(Achievement.game_id == game_id)
    )
    existing_achievements = {a.slug: a for a in result.scalars().all()}
    
    for ach_data in achievements_data:
        if ach_data["slug"] in existing_achievements:
            # Update existing
            existing = existing_achievements[ach_data["slug"]]
            existing.title = ach_data["title"]
            existing.description = ach_data["description"]
        else:
            # Add new
            achievement = Achievement(game_id=game_id, **ach_data)
            db.add(achievement)


# Alias for backward compatibility
async def seed_games(skip_init: bool = False):
    """Alias for sync_games for backward compatibility."""
    await sync_games(skip_init)


if __name__ == "__main__":
    asyncio.run(sync_games())
