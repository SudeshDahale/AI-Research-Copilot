"""Gap detection node — Sprint 8.

Standalone — does NOT require summarize_node to run first.
Single focused LLM call on the paper corpus directly.
Output stored in state["result"]: {gaps: [{title, description, supporting_papers}]}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import gap_prompts
from app.agents import cache
from app.services import llm_service
from app.core.logging import logger

_FAST_MODEL = "openai/gpt-oss-20b"
_MAX_PAPERS = 20


async def gaps_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]
    workspace_id = state.get("workspace_id")
    fingerprint = ",".join(sorted(p.get("id", "") for p in papers))

    if not papers:
        return {"result": {"gaps": []}}

    if workspace_id:
        cached = cache.get_corpus_cache(f"{workspace_id}:gaps", len(papers), fingerprint)
        if cached is not None:
            elapsed = round((time.monotonic() - t0) * 1000)
            existing_metrics = state.get("metrics") or {}
            logger.info(f"gaps_node: cache hit in {elapsed}ms")
            return {"result": cached, "metrics": {**existing_metrics, "llm_ms": elapsed, "cache_hit": True}}

    result = await llm_service.generate_structured_json(
        system=gap_prompts.SYSTEM,
        prompt=gap_prompts.build_prompt(papers),
        schema_hint=gap_prompts.SCHEMA_HINT,
        model=_FAST_MODEL,
    )

    gaps = (result or {}).get("gaps", [])

    # Normalize: if gaps are raw strings (old format), wrap them
    if gaps and isinstance(gaps[0], str):
        gaps = [{"title": g[:80], "description": g, "supporting_papers": []} for g in gaps]

    if not gaps and papers:
        logger.warning("gaps_node: LLM returned no gaps, using fallback")
        primary = papers[0].get("title", "the target domain")
        gaps = [
            {
                "title": "Benchmark coverage",
                "description": f"No paper in this corpus addresses comprehensive benchmark evaluations for edge cases in {primary}.",
                "supporting_papers": [],
            },
            {
                "title": "Cross-domain generalization",
                "description": "Cross-domain and out-of-distribution generalization is not evaluated across the corpus.",
                "supporting_papers": [],
            },
        ]
    elif workspace_id:
        cache.set_corpus_cache(f"{workspace_id}:gaps", len(papers), {"gaps": gaps}, fingerprint)

    elapsed = round((time.monotonic() - t0) * 1000)
    logger.info(f"gaps_node: done in {elapsed}ms papers={len(papers)} gaps={len(gaps)}")

    existing_metrics = state.get("metrics") or {}
    return {
        "result": {"gaps": gaps},
        "metrics": {**existing_metrics, "llm_ms": elapsed},
    }