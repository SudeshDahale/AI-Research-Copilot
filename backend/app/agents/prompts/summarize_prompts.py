"""Prompt text for summarize_node - Sprint 7 (Groq JSON mode)."""
from __future__ import annotations

SCHEMA_HINT = (
    '{"overview": "2-3 sentence summary", '
    '"themes": ["3-5 short theme labels"], '
    '"consensus": "1-2 sentences on where papers agree"}'
)

SYSTEM = (
    "You are a research assistant summarizing a small corpus of papers for a "
    "researcher. Base everything only on the titles and abstracts given - "
    "never invent findings, numbers, or methods that aren't stated."
)


def build_prompt(papers: list[dict], clusters: list[dict]) -> str:
    paper_lines = "\n".join(
        f"- [{p.get('id')}] {p.get('title', '')} ({p.get('year', '?')}): "
        f"{(p.get('abstract') or '')[:400]}"
        for p in papers
    )
    theme_lines = "\n".join(f"- {c.get('theme')}" for c in clusters) or "(no distinct themes found)"

    return (
        f"Papers in scope:\n{paper_lines}\n\n"
        f"Detected themes:\n{theme_lines}\n\n"
        "Produce an overview (2-3 sentences on what this corpus collectively "
        "covers), 3-5 theme labels, and a consensus statement (or 'No clear "
        "consensus' if there isn't one)."
    )