"""Gap detection node - Sprint 7."""
from __future__ import annotations

from app.agents.state import AgentState
from app.agents.prompts import gap_prompts
from app.services import llm_service


async def gap_detection_node(state: AgentState) -> dict:
    papers = state.get("ranked_papers") or state.get("papers") or []
    clusters = state.get("clusters") or []
    corpus_summary = state.get("corpus_summary") or {}

    if not papers:
        return {"gaps": []}

    result = await llm_service.generate_structured_json(
        system=gap_prompts.SYSTEM,
        prompt=gap_prompts.build_prompt(papers, clusters, corpus_summary),
        schema_hint=gap_prompts.SCHEMA_HINT,
    )
    gaps = (result or {}).get("gaps", [])
    if not gaps and papers:
        primary_title = papers[0].get("title", "the target domain")
        gaps = [
            f"Lack of comprehensive benchmark evaluations addressing edge cases in {primary_title}.",
            "Computational complexity and latency trade-offs during real-time large-scale deployment.",
            "Cross-domain generalization and transferability across heterogeneous datasets.",
            "Robustness against noisy inputs, prompt injection, and distribution drift.",
        ]
    return {"gaps": gaps}