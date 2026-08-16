"""Prompt text for gap_detection_node - Sprint 7 (Groq JSON mode)."""
from __future__ import annotations

SCHEMA_HINT = '{"gaps": ["specific, evidence-grounded research gap strings"]}'

SYSTEM = (
    "You are a research assistant identifying genuine gaps in a body of "
    "literature. A gap must be traceable to something actually missing or "
    "unaddressed across the given papers - not a generic template statement "
    "like 'more research is needed'. If the corpus is too small or too "
    "narrow to responsibly claim a gap, return fewer, more honest items "
    "rather than padding the list."
)


def build_prompt(papers: list[dict], clusters: list[dict], corpus_summary: dict) -> str:
    paper_lines = "\n".join(
        f"- [{p.get('id')}] {p.get('title', '')} ({p.get('year', '?')}): "
        f"{(p.get('abstract') or '')[:400]}"
        for p in papers
    )
    theme_lines = "\n".join(f"- {c.get('theme')}" for c in clusters) or "(no distinct themes)"

    return (
        f"Corpus overview: {corpus_summary.get('overview', '')}\n"
        f"Consensus: {corpus_summary.get('consensus', '')}\n\n"
        f"Themes covered:\n{theme_lines}\n\n"
        f"Papers:\n{paper_lines}\n\n"
        "Identify 2-4 specific research gaps this corpus leaves open - things "
        "no paper here addresses, methods no paper combines, populations or "
        "settings no paper tests. Ground each gap in what's actually absent "
        "from the abstracts above."
    )