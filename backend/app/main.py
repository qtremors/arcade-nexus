"""FastAPI application factory for the local browser console."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from app.config import Settings, get_settings
from app.database import engine, init_db, make_engine
from app.middleware import RequestGuard
from app.routers import achievements, games, library, profiles, saves, stats
from app.seed import sync_games

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or get_settings()
    db_engine = (
        engine
        if settings is None
        else make_engine(configuration.DATABASE_URL, debug=configuration.DEBUG)
    )
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        try:
            await init_db(db_engine)
            await sync_games(skip_init=True, session_factory=session_factory)
            logger.info("%s v%s started", configuration.APP_NAME, configuration.APP_VERSION)
            yield
        finally:
            await db_engine.dispose()
            logger.info("Database connections closed")

    application = FastAPI(
        title=configuration.APP_NAME,
        version=configuration.APP_VERSION,
        description="Local browser-based arcade console",
        lifespan=lifespan,
        debug=configuration.DEBUG,
    )
    application.state.settings = configuration
    application.state.engine = db_engine
    application.state.session_factory = session_factory
    application.add_middleware(RequestGuard, settings=configuration)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configuration.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Profile-ID"],
    )
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=configuration.ALLOWED_HOSTS)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # Error input may contain NaN, huge saves, or non-serializable validator context.
        detail = [
            {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
            for item in error.errors()
        ]
        return JSONResponse({"detail": detail}, status_code=422)

    @application.exception_handler(IntegrityError)
    async def integrity_error(request: Request, error: IntegrityError):
        logger.warning("Database constraint conflict on %s", request.url.path)
        return JSONResponse({"detail": "The change conflicts with existing data"}, status_code=409)

    @application.exception_handler(OperationalError)
    async def database_error(request: Request, error: OperationalError):
        code = getattr(error.orig, "sqlite_errorcode", 0)
        if code & 0xFF in {5, 6}:
            return JSONResponse(
                {"detail": "Local database is busy; try again shortly"},
                status_code=503,
                headers={"Retry-After": "1"},
            )
        logger.error("Database operation failed on %s", request.url.path, exc_info=True)
        return JSONResponse({"detail": "Local database operation failed"}, status_code=500)

    for name, router in (
        ("Profiles", profiles.router),
        ("Games", games.router),
        ("Library", library.router),
        ("Saves", saves.router),
        ("Stats", stats.router),
        ("Achievements", achievements.router),
    ):
        application.include_router(router, prefix=f"/api/{name.lower()}", tags=[name])

    @application.get("/")
    async def root() -> dict[str, str]:
        return {
            "name": configuration.APP_NAME,
            "version": configuration.APP_VERSION,
            "status": "running",
        }

    @application.get("/health")
    async def health_check():
        try:
            async with db_engine.connect() as connection:
                await connection.execute(text("SELECT version_num FROM alembic_version"))
        except OperationalError:
            return JSONResponse({"status": "unhealthy"}, status_code=503)
        return {"status": "healthy"}

    return application


app = create_app()
