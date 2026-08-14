"""Redis-backed async cache helper.

Usage
-----
from app.core.cache import cached_search

result = await cached_search("retrieval augmented generation")
"""
from __future__ import annotations

import json
import hashlib
from typing import Any, Awaitable, Callable

import redis.asyncio as aioredis

from app.config import settings
from app.core.logging import logger

# ---------------------------------------------------------------------------
# Client — one lazily-created connection pool shared across the process
# ---------------------------------------------------------------------------

_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the (lazily-initialised) async Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

SEARCH_TTL_SECONDS = 300  # 5 minutes — short enough to stay fresh, long enough to matter


def _make_key(prefix: str, raw: str) -> str:
    """Deterministic cache key: prefix + SHA-256 of the raw string (query)."""
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"arclight:{prefix}:{digest}"


async def cache_get(key: str) -> Any | None:
    """Return deserialised value from Redis, or None on cache miss / error."""
    try:
        client = get_redis()
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:  # pragma: no cover
        logger.warning(f"Redis cache GET failed for key={key!r}: {exc}")
        return None


async def cache_set(key: str, value: Any, ttl: int = SEARCH_TTL_SECONDS) -> None:
    """Serialise *value* to JSON and store it with *ttl* seconds expiry."""
    try:
        client = get_redis()
        await client.setex(key, ttl, json.dumps(value))
    except Exception as exc:  # pragma: no cover
        logger.warning(f"Redis cache SET failed for key={key!r}: {exc}")


# ---------------------------------------------------------------------------
# High-level helper used by the search route
# ---------------------------------------------------------------------------

async def cached_search(
    query: str,
    fetch_fn: Callable[..., Awaitable[list[dict]]],
) -> tuple[list[dict], bool]:
    """Return (results, from_cache).

    *fetch_fn* is called only on a cache miss.  The results are cached under
    a key derived from *query* with a short TTL so repeated identical queries
    skip the external arXiv / Semantic Scholar round-trip entirely.

    The boolean second element lets callers (and log lines) distinguish a
    cache hit from a fresh fetch — useful for verifying Sprint 4's DoD.
    """
    key = _make_key("search", query.lower().strip())

    hit = await cache_get(key)
    if hit is not None:
        logger.info(f"Cache HIT for search query='{query}' key={key}")
        return hit, True

    logger.info(f"Cache MISS for search query='{query}' — calling external APIs")
    results = await fetch_fn(query)
    await cache_set(key, results)
    return results, False
