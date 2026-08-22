"""Context Distillation Layer — Chat Optimization.

Compresses paper abstracts into concise 1-2 line structured insights (Objective, Method, Key Finding)
to prevent wasting LLM tokens on raw, verbose text while preserving high semantic density.
Uses an in-memory LRU cache to ensure zero latency on repeated queries.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Any


def _extract_sentences(text: str) -> list[str]:
    """Split text into clean sentences."""
    if not text:
        return []
    # Split on sentence boundaries
    raw_sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in raw_sentences if s.strip()]


@lru_cache(maxsize=1024)
def distill_paper(paper_id: str, title: str, abstract: str, year: int | None = None) -> str:
    """Produce a high-density, 1-2 sentence distilled summary of a paper.
    
    Format:
    [Title (Year)]: <Objective / Core Method> -> <Key Result / Impact>
    """
    sentences = _extract_sentences(abstract)
    if not sentences:
        return f"- **{title}** ({year or 'n.d.'}): {title}"

    # First sentence is usually the objective/background
    objective = sentences[0]
    
    # Last sentence is usually the main finding/conclusion
    conclusion = sentences[-1] if len(sentences) > 1 else ""

    # Truncate overly long sentences to keep token footprint strictly under control
    if len(objective) > 180:
        objective = objective[:177] + "..."
    if conclusion and len(conclusion) > 180:
        conclusion = conclusion[:177] + "..."

    year_str = f" ({year})" if year else ""
    if conclusion and conclusion != objective:
        return f"- **{title}**{year_str}: {objective} → Key finding: {conclusion}"
    return f"- **{title}**{year_str}: {objective}"


def distill_papers_context(papers: list[dict[str, Any]], max_papers: int = 5) -> str:
    """Convert a list of papers into a compact distilled context block for LLM prompts."""
    if not papers:
        return "No relevant papers available."
    
    selected = papers[:max_papers]
    distilled_lines = []
    for p in selected:
        p_id = str(p.get("id", ""))
        title = p.get("title") or "Untitled"
        abstract = p.get("abstract") or ""
        year = p.get("year")
        distilled_lines.append(distill_paper(p_id, title, abstract, year))

    return "\n".join(distilled_lines)
