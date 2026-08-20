"""Literature review prompts — Sprint 8. Single synthesis call."""
from __future__ import annotations

SCHEMA_HINT = (
    '{"introduction": "1-2 paragraph framing of the field and scope", '
    '"themes": [{"label": "theme name", "summary": "2-3 sentence description of papers in this theme"}], '
    '"discussion": "2-3 paragraphs synthesizing agreements, tensions, and progress", '
    '"research_gaps": ["2-4 specific gaps still unaddressed"], '
    '"conclusion": "1-2 paragraph synthesis and outlook"}'
)

SYSTEM = (
    "You are a research assistant drafting a literature review from a set of paper abstracts. "
    "Synthesize the corpus into a coherent narrative — do not just list papers. "
    "Identify recurring themes, points of consensus, open tensions, and remaining gaps. "
    "Write in an academic but accessible style. "
    "Base only on the abstracts provided — never invent results, datasets, or methods."
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
        "Draft a structured literature review covering:\n"
        "1. Introduction — frame the research area and the scope of this corpus.\n"
        "2. Themes — group papers by shared topics or methods.\n"
        "3. Discussion — synthesize agreements, disagreements, and overall progress.\n"
        "4. Research gaps — what remains unaddressed.\n"
        "5. Conclusion — outlook and significance.\n"
    )
