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

import time

# ---------------------------------------------------------------------------
# Client — one lazily-created connection pool shared across the process
# ---------------------------------------------------------------------------

_redis_client: aioredis.Redis | None = None
_redis_available: bool = True
_last_redis_check: float = 0.0
_REDIS_RETRY_COOLDOWN: float = 30.0  # seconds between reconnection attempts when offline
_has_logged_redis_offline: bool = False

# Resilient in-memory cache fallback: { key: (expiry_timestamp, data) }
_memory_cache: dict[str, tuple[float, Any]] = {}


def get_redis() -> aioredis.Redis:
    """Return the (lazily-initialised) async Redis client with fast timeout."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.75,
            socket_timeout=0.75,
        )
    return _redis_client


def is_redis_online() -> bool:
    """Check if Redis is considered available without blocking on dead sockets."""
    global _redis_available, _last_redis_check
    if _redis_available:
        return True
    return (time.time() - _last_redis_check) > _REDIS_RETRY_COOLDOWN


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

SEARCH_TTL_SECONDS = 300  # 5 minutes — short enough to stay fresh, long enough to matter


def _make_key(prefix: str, raw: str) -> str:
    """Deterministic cache key: prefix + SHA-256 of the raw string (query)."""
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"arclight:{prefix}:{digest}"


async def cache_get(key: str) -> Any | None:
    """Return deserialised value from Redis or in-memory fallback, or None on miss."""
    global _redis_available, _last_redis_check, _has_logged_redis_offline
    now = time.time()

    # 1. Try Redis if it is online
    if is_redis_online():
        try:
            client = get_redis()
            raw = await client.get(key)
            _redis_available = True
            if raw is not None:
                val = json.loads(raw)
                _memory_cache[key] = (now + SEARCH_TTL_SECONDS, val)
                return val
            # Key not found in Redis, check memory cache
        except Exception as exc:  # pragma: no cover
            _redis_available = False
            _last_redis_check = time.time()
            if not _has_logged_redis_offline:
                logger.info(f"Redis is offline ({exc}) — falling back to in-memory caching.")
                _has_logged_redis_offline = True
            else:
                logger.debug(f"Redis cache GET failed for key={key!r}: {exc}")

    # 2. In-memory cache fallback
    if key in _memory_cache:
        exp, val = _memory_cache[key]
        if exp > now:
            return val
        _memory_cache.pop(key, None)

    return None


async def cache_set(key: str, value: Any, ttl: int = SEARCH_TTL_SECONDS) -> None:
    """Serialise *value* to JSON and store it with *ttl* seconds expiry."""
    global _redis_available, _last_redis_check, _has_logged_redis_offline
    now = time.time()

    # Always write to memory cache fallback
    _memory_cache[key] = (now + ttl, value)

    # Write to Redis if online
    if is_redis_online():
        try:
            client = get_redis()
            await client.setex(key, ttl, json.dumps(value))
            _redis_available = True
        except Exception as exc:  # pragma: no cover
            _redis_available = False
            _last_redis_check = time.time()
            if not _has_logged_redis_offline:
                logger.info(f"Redis is offline ({exc}) — falling back to in-memory caching.")
                _has_logged_redis_offline = True
            else:
                logger.debug(f"Redis cache SET failed for key={key!r}: {exc}")


# ---------------------------------------------------------------------------
# High-level helper used by the search route
# ---------------------------------------------------------------------------

async def cached_search(
    query: str,
    fetch_fn: Callable[..., Awaitable[list[dict]]],
    page: int = 1,
    limit: int = 30,
) -> tuple[list[dict], bool]:
    """Return (results, from_cache).

    *fetch_fn* is called only on a cache miss. The results are cached under
    a key derived from *query*, *page*, and *limit* with a short TTL so repeated identical queries
    skip the external arXiv / Semantic Scholar round-trip entirely.
    """
    raw_key = f"{query.lower().strip()}:p{page}:l{limit}"
    key = _make_key("search", raw_key)

    hit = await cache_get(key)
    if hit is not None:
        logger.info(f"Cache HIT for search key='{raw_key}'")
        return hit, True

    logger.info(f"Cache MISS for search key='{raw_key}' — calling external APIs")
    results = await fetch_fn(query, page=page, limit=limit)
    await cache_set(key, results)
    return results, False
