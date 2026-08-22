"""Literature review node — Sprint 8.

Standalone synthesis. Single LLM call (no summarize/gap chain).
Uses larger token budget for the complex synthesis task.
Output stored in state["result"]:
  {introduction, themes, discussion, research_gaps, conclusion}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import review_prompts
from app.agents import cache
from app.services import llm_service
from app.core.logging import logger

_MAX_PAPERS = 20
_MODEL = "openai/gpt-oss-120b"
_LIT_REVIEW_MAX_TOKENS = 3000  # larger budget for narrative synthesis


async def review_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]
    workspace_id = state.get("workspace_id")

    if not papers:
        return {
            "result": {
                "introduction": "No papers in scope to review.",
                "themes": [],
                "discussion": "",
                "research_gaps": [],
                "conclusion": "",
            }
        }

    if workspace_id:
        cached = cache.get_corpus_cache(f"{workspace_id}:review", len(papers))
        if cached is not None:
            elapsed = round((time.monotonic() - t0) * 1000)
            existing_metrics = state.get("metrics") or {}
            logger.info(f"review_node: cache hit in {elapsed}ms")
            return {"result": cached, "metrics": {**existing_metrics, "llm_ms": elapsed, "cache_hit": True}}

    result = await llm_service.generate_structured_json(
        system=review_prompts.SYSTEM,
        prompt=review_prompts.build_prompt(papers),
        schema_hint=review_prompts.SCHEMA_HINT,
        model=_MODEL,
        max_tokens=_LIT_REVIEW_MAX_TOKENS,
    )

    if result is None:
        logger.warning("review_node: LLM returned None, using fallback")
        result = {
            "introduction": (
                f"This literature review covers {len(papers)} papers across the identified research domain."
            ),
            "themes": [],
            "discussion": "Detailed synthesis unavailable — LLM did not respond.",
            "research_gaps": [],
            "conclusion": "Further analysis required.",
        }
    elif workspace_id:
        cache.set_corpus_cache(f"{workspace_id}:review", len(papers), result)

    elapsed = round((time.monotonic() - t0) * 1000)
    logger.info(f"review_node: done in {elapsed}ms papers={len(papers)}")

    existing_metrics = state.get("metrics") or {}
    return {
        "result": result,
        "metrics": {**existing_metrics, "llm_ms": elapsed},
    }