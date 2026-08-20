"""Compare prompts — Sprint 8. Methodology comparison across papers."""
from __future__ import annotations

SCHEMA_HINT = (
    '{"comparisons": ['
    '{"method": "method or approach name", '
    '"papers": ["paper title or id"], '
    '"strengths": ["list of strengths"], '
    '"weaknesses": ["list of weaknesses"], '
    '"differences": ["key differences from other methods"]}'
    ']}'
)

SYSTEM = (
    "You are a research analyst comparing methodologies across a set of papers. "
    "Identify the distinct methods, models, or approaches each paper uses. "
    "For each method, list its strengths, weaknesses, and how it differs from the others. "
    "Base only on what is stated in the abstracts — do not invent details. "
    "If papers share the same method, group them together."
)

_MAX_ABSTRACT = 450


def build_prompt(papers: list[dict]) -> str:
    paper_lines = "\n".join(
        f"[{p.get('id', '?')}] {p.get('title', '')} ({p.get('year', '?')}): "
        f"{(p.get('abstract') or '')[:_MAX_ABSTRACT]}"
        for p in papers
    )
    return (
        f"Papers in scope ({len(papers)} total):\n{paper_lines}\n\n"
        "Compare the methodologies, models, or approaches used across these papers. "
        "Group by method where applicable. "
        "For each method identify: which papers use it, its strengths, its weaknesses, "
        "and how it differs from the other methods in this corpus."
    )
