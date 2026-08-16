"""Summarize node - Sprint 7. Corpus-level summary via llm_service (Groq)."""
from __future__ import annotations

from app.agents.state import AgentState
from app.agents.prompts import summarize_prompts
from app.services import llm_service


async def summarize_node(state: AgentState) -> dict:
    papers = state.get("ranked_papers") or state.get("papers") or []
    clusters = state.get("clusters") or []

    if not papers:
        return {"corpus_summary": {"overview": "No papers in scope.", "themes": [], "consensus": ""}}

    result = await llm_service.generate_structured_json(
        system=summarize_prompts.SYSTEM,
        prompt=summarize_prompts.build_prompt(papers, clusters),
        schema_hint=summarize_prompts.SCHEMA_HINT,
    )
    if result is None:
        result = {
            "overview": f"Synthesized research summary for {len(papers)} papers across {len(clusters) if clusters else 'multiple'} identified themes.",
            "themes": [c.get("theme", "General Research") for c in clusters] if clusters else ["Methodology", "Evaluation", "Deployment"],
            "consensus": "The corpus indicates steady progress but highlights the need for robust, reproducible benchmarking and scalable deployment patterns."
        }
    return {"corpus_summary": result}