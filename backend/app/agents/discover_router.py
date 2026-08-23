"""Rule-based intent detection for the Discover-page chat.

Mirrors the pattern in agents/router.py (workspace chat) — cheap regex/keyword
matching first, no LLM call just to classify. Kept to a small, closed set of
intents since this assistant's job is narrow: help pick papers, not analyze them.
"""
from __future__ import annotations

import re

from app.core.logging import logger

_TOP_N_PATTERN = re.compile(r"\btop\s*(\d+)\b|\b(\d+)\s+(?:most\s+relevant|best)\b", re.IGNORECASE)
_ADD_WORDS = {"add", "create workspace", "save these", "add these", "add to workspace"}
_SEARCH_WORDS = {"search", "find papers", "look up", "new search"}


def detect_discover_intent(message: str) -> tuple[str, dict]:
    """Returns (intent, extra) where extra carries any parsed arguments.

    Intents: "top_n", "add_to_workspace", "search", "filter" (fallback —
    anything that isn't clearly one of the above is treated as a natural-
    language filter request, since that's this assistant's main job).
    """
    text = message.strip().lower()

    top_n_match = _TOP_N_PATTERN.search(text)
    if top_n_match:
        n = int(top_n_match.group(1) or top_n_match.group(2))
        logger.info(f"detect_discover_intent: rule-based match 'top_n' n={n} for message={message!r}")
        return "top_n", {"n": n}

    if any(w in text for w in _ADD_WORDS):
        logger.info(f"detect_discover_intent: rule-based match 'add_to_workspace' for message={message!r}")
        return "add_to_workspace", {}

    if any(w in text for w in _SEARCH_WORDS):
        logger.info(f"detect_discover_intent: rule-based match 'search' for message={message!r}")
        return "search", {}

    # Fallback: treat as a natural-language filter request (year, topic, author, etc.)
    logger.info(f"detect_discover_intent: falling back to 'filter' for message={message!r}")
    return "filter", {}