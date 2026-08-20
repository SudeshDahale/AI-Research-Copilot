"""Gap detection prompts — Sprint 8.

Standalone: does NOT require a corpus_summary from summarize_node.
The LLM reads papers directly and identifies gaps itself.
"""
from __future__ import annotations

SCHEMA_HINT = (
    '{"gaps": ['
    '{"title": "short gap label", "description": "2-3 sentence evidence-grounded description", '
    '"supporting_papers": ["paper id or title"]}'
    ']}'
)

SYSTEM = (
    "You are a research analyst identifying genuine, evidence-grounded gaps in a body of literature. "
    "A gap must be directly traceable to something absent, untested, or unaddressed across the given papers. "
    "Do NOT produce generic statements like 'more research is needed'. "
    "If the corpus is too small or narrow to claim a gap responsibly, return fewer honest items. "
    "Ground each gap in specific paper titles or findings."
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
        "Identify 2–5 specific research gaps this corpus leaves open: "
        "methods no paper combines, populations no paper tests, "
        "benchmarks missing, or conclusions that rely on unstated assumptions. "
        "For each gap cite which paper(s) reveal the absence."
    )