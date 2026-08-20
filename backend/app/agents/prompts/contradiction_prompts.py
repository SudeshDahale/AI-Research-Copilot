"""Contradiction detection prompts — Sprint 8.

Instructs the LLM to find actual disagreements between papers,
NOT just summarize each paper independently.
"""
from __future__ import annotations

SCHEMA_HINT = (
    '{"contradictions": ['
    '{"topic": "the claim or topic where papers disagree", '
    '"paper_a": "title or id of first paper", '
    '"claim_a": "what paper_a claims", '
    '"paper_b": "title or id of second paper", '
    '"claim_b": "what paper_b claims", '
    '"difference": "precise description of the disagreement", '
    '"evidence": "direct quote or paraphrase from abstracts supporting this"}'
    ']}'
)

SYSTEM = (
    "You are a research analyst identifying genuine contradictions and disagreements between papers. "
    "A contradiction means two papers make opposing or incompatible empirical claims, conclusions, "
    "or recommendations about the same topic, method, or dataset. "
    "Do NOT report mere differences in scope, focus, or application domain as contradictions. "
    "Only flag genuine conflicts where paper A says X and paper B says not-X (or the opposite). "
    "If no genuine contradictions exist in this corpus, return an empty list. "
    "Base only on the abstracts provided — do not invent claims."
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
        "Identify genuine contradictions: pairs of papers that make opposing claims "
        "about the same topic, finding, or recommendation. "
        "For each contradiction, state precisely what paper A claims versus what paper B claims "
        "and cite the text evidence from the abstracts above."
    )
