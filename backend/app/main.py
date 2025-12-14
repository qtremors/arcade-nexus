"""
Arcade Nexus - FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, AsyncSessionLocal
from app.models.game import Game

# Import routers
from app.routers import games, library, saves, stats, achievements, profiles

settings = get_settings()


async def auto_seed_if_needed():
    """Auto-seed database with games if none exist."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Game).limit(1))
        if result.scalar_one_or_none() is None:
            print("📦 No games found, auto-seeding...")
            from app.seed import seed_games
            await seed_games(skip_init=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await init_db()
    await auto_seed_if_needed()
    print(f"🎮 {settings.APP_NAME} v{settings.APP_VERSION} started!")
    yield
    # Shutdown
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Browser-based gaming console backend",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(library.router, prefix="/api/library", tags=["Library"])
app.include_router(saves.router, prefix="/api/saves", tags=["Saves"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(achievements.router, prefix="/api/achievements", tags=["Achievements"])


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
