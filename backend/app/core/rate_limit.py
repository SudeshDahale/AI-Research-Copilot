"""Async Rate Limiting module — Sprint 9.

Implements sliding-window rate limiting using Redis (with in-memory fallback
for testing or when Redis is unavailable).
Supports per-user (for authenticated routes) and per-IP (for public routes) tracking.
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.core.cache import get_redis
from app.core.logging import logger
from app.dependencies import get_current_user_optional
from app.models.user import User


# In-memory sliding window fallback: { key: [timestamp1, timestamp2, ...] }
_memory_rate_limit_store: dict[str, list[float]] = defaultdict(list)


class RateLimiter:
    """FastAPI dependency for rate limiting expensive endpoints."""

    def __init__(
        self,
        requests_per_minute: int = 30,
        key_prefix: str = "rl",
        use_user_id: bool = True,
    ) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
        self.key_prefix = key_prefix
        self.use_user_id = use_user_id

    async def __call__(
        self,
        request: Request,
        current_user: User | None = Depends(get_current_user_optional),
    ) -> None:
        if self.use_user_id and current_user:
            identifier = str(current_user.id)
        else:
            client_host = request.client.host if request.client else "127.0.0.1"
            forwarded = request.headers.get("x-forwarded-for")
            identifier = forwarded.split(",")[0].strip() if forwarded else client_host

        key = f"rate_limit:{self.key_prefix}:{identifier}"
        now = time.time()
        window_start = now - self.window_seconds

        # 1. Try Redis sliding window with sorted set (ZADD/ZREMRANGEBYSCORE/ZCARD)
        try:
            redis = get_redis()
            pipe = redis.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, self.window_seconds + 5)
            results = await pipe.execute()
            current_count = results[2]

            if current_count > self.requests_per_minute:
                logger.warning(f"Rate limit exceeded (Redis) for key={key}: {current_count}/{self.requests_per_minute} req/min")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute allowed.",
                    headers={"Retry-After": str(self.window_seconds)},
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug(f"Redis rate limiter unavailable ({exc}) — falling back to in-memory window")

        # 2. In-memory sliding window fallback
        timestamps = _memory_rate_limit_store[key]
        # Prune old timestamps
        _memory_rate_limit_store[key] = [ts for ts in timestamps if ts > window_start]
        _memory_rate_limit_store[key].append(now)

        if len(_memory_rate_limit_store[key]) > self.requests_per_minute:
            logger.warning(f"Rate limit exceeded (In-Memory) for key={key}: {len(_memory_rate_limit_store[key])}/{self.requests_per_minute} req/min")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute allowed.",
                headers={"Retry-After": str(self.window_seconds)},
            )
