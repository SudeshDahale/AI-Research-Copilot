from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.logging import configure_logging, logger

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s starting up (environment=%s)", settings.app_name, settings.environment)
    # Self-healing check: ensure 'profession' column exists on users table
    try:
        from app.db.session import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(120) DEFAULT 'Academic Researcher';")
            )
        logger.info("Checked/verified 'profession' column on users table.")
    except Exception as exc:
        logger.warning("Automatic column check for 'profession' skipped or deferred: %s", exc)

    yield
    logger.info("%s shutting down", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
