"""Summary prompts — Sprint 8. One focused LLM call, no clustering prerequisite."""
from __future__ import annotations

SCHEMA_HINT = (
    '{"overview": "2-3 sentence synthesis of what this corpus collectively covers", '
    '"themes": ["3-5 short theme labels"], '
    '"key_findings": ["2-4 most important findings across the corpus"]}'
)

SYSTEM = (
    "You are a research assistant summarizing a corpus of papers for a researcher. "
    "Base everything only on the titles and abstracts provided — never invent findings, "
    "numbers, or methods that are not stated. Be concise and precise."
)

_MAX_ABSTRACT = 400


def build_prompt(papers: list[dict]) -> str:
    paper_lines = "\n".join(
        f"- [{p.get('id', '?')}] {p.get('title', '')} ({p.get('year', '?')}): "
        f"{(p.get('abstract') or '')[:_MAX_ABSTRACT]}"
        for p in papers
    )
    return (
        f"Papers in scope ({len(papers)} total):\n{paper_lines}\n\n"
        "Produce:\n"
        "1. An overview (2-3 sentences on what this corpus collectively covers).\n"
        "2. 3-5 theme labels.\n"
        "3. 2-4 key findings or conclusions the papers share or highlight.\n"
    )
