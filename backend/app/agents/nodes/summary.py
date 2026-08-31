"""Summary node — Sprint 8.

Single focused LLM call. Does NOT require clustering or ranking to run first.
Input: papers list (title, abstract, year — no embeddings).
Output stored in state["result"]: {overview, themes, key_findings}
"""
from __future__ import annotations

import time

from app.agents.state import AgentState
from app.agents.prompts import summary_prompts
from app.agents import cache
from app.services import llm_service
from app.core.logging import logger

_FAST_MODEL = "openai/gpt-oss-20b"
_MAX_PAPERS = 20  # cap papers sent to LLM to keep prompt tight


async def summary_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    papers = (state.get("papers") or [])[:_MAX_PAPERS]
    workspace_id = state.get("workspace_id")
    fingerprint = ",".join(sorted(p.get("id", "") for p in papers))

    if not papers:
        return {
            "result": {"overview": "No papers in scope.", "themes": [], "key_findings": []},
        }

    # Cache check — same workspace snapshot + same intent = same answer.
    if workspace_id:
        cached = cache.get_corpus_cache(f"{workspace_id}:summary", len(papers), fingerprint)
        if cached is not None:
            elapsed = round((time.monotonic() - t0) * 1000)
            existing_metrics = state.get("metrics") or {}
            logger.info(f"summary_node: cache hit in {elapsed}ms")
            return {"result": cached, "metrics": {**existing_metrics, "llm_ms": elapsed, "cache_hit": True}}

    result = await llm_service.generate_structured_json(
        system=summary_prompts.SYSTEM,
        prompt=summary_prompts.build_prompt(papers),
        schema_hint=summary_prompts.SCHEMA_HINT,
        model=_FAST_MODEL,
    )

    if result is None:
        logger.warning("summary_node: LLM returned None, using fallback")
        result = {
            "overview": f"Corpus of {len(papers)} papers covering multiple research themes.",
            "themes": ["Methodology", "Evaluation", "Applications"],
            "key_findings": ["See individual papers for specific findings."],
        }
    elif workspace_id:
                cache.set_corpus_cache(f"{workspace_id}:summary", len(papers), result, fingerprint)

    elapsed = round((time.monotonic() - t0) * 1000)
    logger.info(f"summary_node: done in {elapsed}ms papers={len(papers)}")

    existing_metrics = state.get("metrics") or {}
    return {
        "result": result,
        "metrics": {**existing_metrics, "llm_ms": elapsed},
    }