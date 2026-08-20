"""Workspace corpus cache — Sprint 8.

In-process cache for expensive workspace-level analysis (clusters, themes).
Key: (workspace_id, paper_count) — invalidated automatically when papers are
added or removed from the workspace (paper_count changes).

We intentionally avoid caching final user answers — only corpus-level
structural analysis that doesn't depend on the specific query.
"""
from __future__ import annotations

import time
from typing import Any

from app.core.logging import logger

# Cache entry: {"data": {...}, "ts": float}
_corpus_cache: dict[str, dict] = {}

# How long corpus analysis stays valid (seconds).
# Workspaces rarely change mid-session; 30 min is safe.
CORPUS_TTL = 1800


def _make_key(workspace_id: str, paper_count: int) -> str:
    return f"corpus:{workspace_id}:{paper_count}"


def get_corpus_cache(workspace_id: str, paper_count: int) -> dict | None:
    """Return cached corpus analysis or None on miss/expiry."""
    key = _make_key(workspace_id, paper_count)
    entry = _corpus_cache.get(key)
    if entry is None:
        return None
    if time.monotonic() - entry["ts"] > CORPUS_TTL:
        del _corpus_cache[key]
        logger.debug(f"corpus_cache: expired key={key!r}")
        return None
    logger.info(f"corpus_cache: HIT key={key!r}")
    return entry["data"]


def set_corpus_cache(workspace_id: str, paper_count: int, data: dict) -> None:
    """Store corpus analysis for this workspace snapshot."""
    key = _make_key(workspace_id, paper_count)
    _corpus_cache[key] = {"data": data, "ts": time.monotonic()}
    logger.info(f"corpus_cache: SET key={key!r}")


def invalidate_workspace(workspace_id: str) -> int:
    """Remove all cached entries for a workspace. Returns number evicted."""
    prefix = f"corpus:{workspace_id}:"
    keys = [k for k in _corpus_cache if k.startswith(prefix)]
    for k in keys:
        del _corpus_cache[k]
    if keys:
        logger.info(f"corpus_cache: invalidated {len(keys)} entries for workspace {workspace_id}")
    return len(keys)


def cache_stats() -> dict[str, Any]:
    return {"size": len(_corpus_cache), "keys": list(_corpus_cache.keys())}
