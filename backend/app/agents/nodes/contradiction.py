"""Contradiction detection node — Sprint 8.

New node — did not exist before. Identifies genuine opposing claims between papers.
Single LLM call. Output stored in state["result"]:
  {contradictions: [{topic, paper_a, claim_a, paper_b, claim_b, difference, evidence}]}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import contradiction_prompts
from app.services import llm_service
from app.core.logging import logger

_MAX_PAPERS = 15


async def contradiction_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]

    if not papers:
        return {"result": {"contradictions": []}}

    if len(papers) < 2:
        return {
            "result": {
                "contradictions": [],
                "_note": "At least 2 papers are needed to detect contradictions.",
            }
        }

    result = await llm_service.generate_structured_json(
        system=contradiction_prompts.SYSTEM,
        prompt=contradiction_prompts.build_prompt(papers),
        schema_hint=contradiction_prompts.SCHEMA_HINT,
    )

    contradictions = (result or {}).get("contradictions", [])

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
