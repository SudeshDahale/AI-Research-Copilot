"""Prompt text for lit_review_node - Sprint 7 (Groq JSON mode)."""
from __future__ import annotations

SCHEMA_HINT = '{"narrative": "3-5 paragraph literature-review narrative, markdown allowed"}'

SYSTEM = (
    "You are drafting the narrative section of a literature review. Write in "
    "flowing prose (not a bullet list), synthesizing across papers rather "
    "than summarizing them one by one. Reference papers by author-surname + "
    "year, e.g. '(Chen et al., 2023)', when discussing a specific finding. "
    "Only claim things directly supported by the given abstracts."
)


def build_prompt(
    papers: list[dict], clusters: list[dict], corpus_summary: dict, gaps: list[str]
) -> str:
    paper_lines = "\n".join(
        f"- {(p.get('authors') or ['Unknown'])[0]} et al. ({p.get('year', '?')}) "
        f"[{p.get('id')}]: {p.get('title', '')} - {(p.get('abstract') or '')[:400]}"
        for p in papers
    )
    theme_lines = "\n".join(f"- {c.get('theme')}" for c in clusters) or "(no distinct themes)"
    gap_lines = "\n".join(f"- {g}" for g in gaps) or "(none identified)"

    return (
        f"Overview: {corpus_summary.get('overview', '')}\n"
        f"Themes:\n{theme_lines}\n\n"
        f"Papers:\n{paper_lines}\n\n"
        f"Known gaps to mention near the end:\n{gap_lines}\n\n"
        "Write the narrative section: synthesize methods and findings across "
        "papers grouped by theme, note where they agree or diverge, and close "
        "by naming the gaps above as open problems."
    )