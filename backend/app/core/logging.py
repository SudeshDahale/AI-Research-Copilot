from __future__ import annotations

import logging
import sys

from app.config import settings


def configure_logging() -> None:
    """Basic structured-ish logging setup. Call once, at app startup."""
    level = logging.DEBUG if settings.debug else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # Quiet down noisy third-party loggers — these fire at DEBUG level and
    # flood stdout, making every request feel slow due to I/O contention.
    for noisy in (
        "uvicorn.access",
        "sqlalchemy.engine",
        "sqlalchemy.pool",
        "sqlalchemy.dialects",
        "sqlalchemy.orm",
        "asyncpg",
        "watchfiles",
        "httpx",
        "httpcore",
        "groq",
        "voyageai",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)


logger = logging.getLogger("arclight")