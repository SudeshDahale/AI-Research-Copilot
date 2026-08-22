"""Contradiction detection node — Sprint 8.

New node — did not exist before. Identifies genuine opposing claims between papers.
Single LLM call. Output stored in state["result"]:
  {contradictions: [{topic, paper_a, claim_a, paper_b, claim_b, difference, evidence}]}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import contradiction_prompts
from app.agents import cache
from app.services import llm_service
from app.core.logging import logger

_FAST_MODEL = "openai/gpt-oss-20b"
_MAX_PAPERS = 15


async def contradiction_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]
    workspace_id = state.get("workspace_id")

    if not papers:
        return {"result": {"contradictions": []}}

    if len(papers) < 2:
        return {
            "result": {
                "contradictions": [],
                "_note": "At least 2 papers are needed to detect contradictions.",
            }
        }

    if workspace_id:
        cached = cache.get_corpus_cache(f"{workspace_id}:contradictions", len(papers))
        if cached is not None:
            elapsed = round((time.monotonic() - t0) * 1000)
            existing_metrics = state.get("metrics") or {}
            logger.info(f"contradiction_node: cache hit in {elapsed}ms")
            return {"result": cached, "metrics": {**existing_metrics, "llm_ms": elapsed, "cache_hit": True}}

    result = await llm_service.generate_structured_json(
        system=contradiction_prompts.SYSTEM,
        prompt=contradiction_prompts.build_prompt(papers),
        schema_hint=contradiction_prompts.SCHEMA_HINT,
        model=_FAST_MODEL,
    )

    contradictions = (result or {}).get("contradictions", [])

    if workspace_id and contradictions:
        cache.set_corpus_cache(f"{workspace_id}:contradictions", len(papers), {"contradictions": contradictions})

    elapsed = round((time.monotonic() - t0) * 1000)
    logger.info(
        f"contradiction_node: done in {elapsed}ms "
        f"papers={len(papers)} contradictions={len(contradictions)}"
    )

    existing_metrics = state.get("metrics") or {}
    return {
        "result": {"contradictions": contradictions},
        "metrics": {**existing_metrics, "llm_ms": elapsed},
    }