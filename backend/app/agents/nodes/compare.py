"""Compare node — Sprint 8.

Methodology comparison across papers. New node — did not exist before.
Single LLM call. Output stored in state["result"]:
  {comparisons: [{method, papers, strengths, weaknesses, differences}]}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import compare_prompts
from app.services import llm_service
from app.core.logging import logger

_MAX_PAPERS = 15  # comparison gets verbose; keep prompt manageable


async def compare_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]

    if not papers:
        return {"result": {"comparisons": []}}

    if len(papers) < 2:
        return {
            "result": {
                "comparisons": [],
                "_note": "At least 2 papers are needed for a methodology comparison.",
            }
        }

    result = await llm_service.generate_structured_json(
        system=compare_prompts.SYSTEM,
        prompt=compare_prompts.build_prompt(papers),
        schema_hint=compare_prompts.SCHEMA_HINT,
    )

    comparisons = (result or {}).get("comparisons", [])

    if not comparisons:
        logger.warning("compare_node: LLM returned no comparisons")
        comparisons = []

    elapsed = round((time.monotonic() - t0) * 1000)
    logger.info(f"compare_node: done in {elapsed}ms papers={len(papers)} comparisons={len(comparisons)}")

    existing_metrics = state.get("metrics") or {}
    return {
        "result": {"comparisons": comparisons},
        "metrics": {**existing_metrics, "llm_ms": elapsed},
    }
