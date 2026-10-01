"""Rule-based intent detection for the Discover-page chat."""
from __future__ import annotations

import re
from app.core.logging import logger

_TOP_N_PATTERN = re.compile(r"\btop\s*(\d+)\b|\b(\d+)\s+(?:most\s+relevant|best)\b", re.IGNORECASE)
_ADD_PATTERN = re.compile(
    r"\b(create|save|add|make|export|build)\b.*\b(work\s*space|workpasce|wrkspace|workspace|collection|folder)\b|\b(add|save)\s+(these|to\s+workspace)\b",
    re.IGNORECASE
)
_SEARCH_WORDS = {"new search", "search for", "find papers on"}


def detect_discover_intent(message: str) -> tuple[str, dict]:
    """Returns (intent, extra) where extra carries any parsed arguments."""
    text = message.strip().lower()

    top_n_match = _TOP_N_PATTERN.search(text)
    if top_n_match:
        n = int(top_n_match.group(1) or top_n_match.group(2))
        logger.info(f"detect_discover_intent: rule-based match 'top_n' n={n} for message={message!r}")
        return "top_n", {"n": n}

    if _ADD_PATTERN.search(text):
        logger.info(f"detect_discover_intent: rule-based match 'add_to_workspace' for message={message!r}")
        return "add_to_workspace", {}

    if any(w in text for w in _SEARCH_WORDS):
        logger.info(f"detect_discover_intent: rule-based match 'search' for message={message!r}")
        return "search", {}

    logger.info(f"detect_discover_intent: falling back to 'filter' for message={message!r}")
    return "filter", {}