"""Context Distillation Layer — Full Academic Fidelity.

Formats paper abstracts and metadata (Title, Authors, Year, Venue, Citations, Abstract)
to provide high-fidelity context for LLM generation while staying within token budgets.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any


def format_paper_context(paper: dict[str, Any], max_abstract_len: int = 1200) -> str:
    """Produce a high-density, full-context representation of a research paper."""
    title = paper.get("title") or "Untitled"
    year = paper.get("year") or "n.d."
    journal = paper.get("journal") or "Academic Publication"
    citations = paper.get("citations", 0)
    
    authors = paper.get("authors") or []
    if isinstance(authors, list) and authors:
        author_str = ", ".join(str(a) for a in authors[:3]) + (" et al." if len(authors) > 3 else "")
    else:
        author_str = "Unknown"

    abstract = (paper.get("abstract") or "").strip()
    if len(abstract) > max_abstract_len:
        abstract = abstract[:max_abstract_len - 3] + "..."
    if not abstract:
        abstract = "No abstract available."

    tags = paper.get("tags") or []
    tag_str = f" | **Keywords**: {', '.join(str(t) for t in tags[:4])}" if tags else ""

    return (
        f"### Paper: {title} ({year})\n"
        f"- **Authors**: {author_str}\n"
        f"- **Venue**: {journal} | **Citations**: {citations}{tag_str}\n"
        f"- **Abstract**: {abstract}"
    )


@lru_cache(maxsize=1024)
def distill_paper(paper_id: str, title: str, abstract: str, year: int | None = None) -> str:
    """Backwards-compatible single-paper distillation with full abstract context."""
    return format_paper_context({
        "id": paper_id,
        "title": title,
        "abstract": abstract,
        "year": year,
    })


def distill_papers_context(papers: list[dict[str, Any]], max_papers: int = 8) -> str:
    """Convert top candidate papers into a rich context block for LLM synthesis."""
    if not papers:
        return "No relevant papers available in context."
    
    selected = papers[:max_papers]
    return "\n\n".join(format_paper_context(p) for p in selected)
