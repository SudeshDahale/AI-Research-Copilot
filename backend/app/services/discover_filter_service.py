"""Applies Discover-chat filters to an already-fetched list of candidate papers.

Two paths:
  - top_n: pure Python slicing on the already-ranked list. Zero LLM calls,
    near-instant — the ranking already happened in /search.
  - natural-language filter: ONE small, fast-model LLM call to turn a fuzzy
    sentence into a structured filter, then plain Python filtering. Nothing
    like the multi-paragraph analysis the workspace chat does, so this stays
    sub-second.
"""
from __future__ import annotations

from app.services import llm_service
from app.core.logging import logger

_FAST_MODEL = "openai/gpt-oss-20b"

_FILTER_SYSTEM = (
    "You extract structured filter criteria from a user's natural-language request "
    "about a list of research papers. Only extract what's explicitly implied — "
    "leave fields empty/null if the user didn't mention them. Do not invent constraints."
)
_FILTER_SCHEMA_HINT = (
    '{"min_year": <int or null>, "max_year": <int or null>, '
    '"keywords": [<lowercase strings, topics/methods mentioned>], '
    '"limit": <int or null, only if user asked for a specific count>}'
)


def top_n(candidates: list[dict], n: int) -> list[dict]:
    """Candidates are assumed already ranked (see /search's rank_papers)."""
    n = max(1, min(n, len(candidates)))
    return candidates[:n]


async def extract_filter(message: str) -> dict:
    """One small LLM call — converts free text into a structured filter dict."""
    result = await llm_service.generate_structured_json(
        system=_FILTER_SYSTEM,
        prompt=f"User request: {message}",
        schema_hint=_FILTER_SCHEMA_HINT,
        model=_FAST_MODEL,
        max_tokens=200,  # tiny — this is a small structured object, not prose
    )
    if result is None:
        logger.warning("extract_filter: LLM returned None, using empty filter (no-op)")
        return {}
    return result


def apply_filter(candidates: list[dict], filt: dict) -> list[dict]:
    """Pure-Python filtering — no LLM involved here, just the parsed criteria."""
    results = candidates

    min_year = filt.get("min_year")
    if min_year:
        results = [p for p in results if p.get("year", 0) >= min_year]

    max_year = filt.get("max_year")
    if max_year:
        results = [p for p in results if p.get("year", 9999) <= max_year]

    keywords = filt.get("keywords") or []
    if keywords:
        def matches(p: dict) -> bool:
            haystack = f"{p.get('title', '')} {p.get('abstract', '')} {' '.join(p.get('tags', []))}".lower()
            return any(kw.lower() in haystack for kw in keywords)
        results = [p for p in results if matches(p)]

    limit = filt.get("limit")
    if limit:
        results = results[: int(limit)]

    return results