"""Deep Pipeline — Agent Engine for In-Depth Scientific Research.

Runs intent-specific analysis directly on in-memory papers (skipping re-retrieval)
and composes the final synthesis without blocking the fast streaming path.
"""
from __future__ import annotations

import time
from typing import Any

from app.agents.nodes.summary import summary_node
from app.agents.nodes.gaps import gaps_node
from app.agents.nodes.compare import compare_node
from app.agents.nodes.contradiction import contradiction_node
from app.agents.nodes.review import review_node
from app.agents.nodes.compose import compose_node
from app.core.logging import logger

_ANALYZE_LABELS = {
    "summary": "Synthesizing full corpus summary",
    "gaps": "Identifying deep research gaps",
    "compare": "Comparing methodologies and benchmarks",
    "contradictions": "Analyzing contradictions and nuances",
    "review": "Drafting structured literature review",
}

_NODE_MAP = {
    "summary": (summary_node, "summary", _ANALYZE_LABELS["summary"]),
    "gaps": (gaps_node, "gaps", _ANALYZE_LABELS["gaps"]),
    "compare": (compare_node, "compare", _ANALYZE_LABELS["compare"]),
    "contradictions": (contradiction_node, "contradictions", _ANALYZE_LABELS["contradictions"]),
    "literature_review": (review_node, "review", _ANALYZE_LABELS["review"]),
    "generic": (summary_node, "summary", _ANALYZE_LABELS["summary"]),
}


async def run_deep_pipeline_async(
    query: str,
    intent: str,
    workspace_id: str | None = None,
    papers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Execute deep analysis directly on in-memory papers (no re-retrieval).
    
    Returns:
        {
            "stage": stage_name,
            "stage_message": stage_label,
            "final_text": final_text,
            "metrics": {...}
        }
    """
    t0 = time.monotonic()
    papers = papers or []
    
    handler, stage_name, stage_label = _NODE_MAP.get(
        intent, (summary_node, "summary", _ANALYZE_LABELS["summary"])
    )
    
    logger.info(f"deep_pipeline: running direct analysis stage={stage_name!r} on {len(papers)} papers (skipping re-retrieval)")
    
    state: dict[str, Any] = {
        "query": query,
        "intent": intent,
        "workspace_id": workspace_id,
        "papers": papers,
        "metrics": {"deep_start_ms": round(time.monotonic() * 1000)},
    }
    
    try:
        # 1. Run intent-specific analysis node
        node_result = await handler(state)
        state.update(node_result)
        
        # 2. Run compose node to generate final Markdown report
        compose_result = await compose_node(state)
        final_text = compose_result.get("final_text", "")
        metrics = compose_result.get("metrics") or {}
        
        total_ms = round((time.monotonic() - t0) * 1000)
        logger.info(f"deep_pipeline: completed direct analysis in {total_ms}ms")
        
        return {
            "stage": stage_name,
            "stage_message": stage_label,
            "final_text": final_text,
            "metrics": {**metrics, "deep_total_ms": total_ms},
            "error": None,
        }
    except Exception as exc:
        logger.error(f"deep_pipeline direct execution error: {exc}", exc_info=True)
        return {
            "stage": stage_name,
            "stage_message": stage_label,
            "final_text": "",
            "metrics": {"deep_total_ms": round((time.monotonic() - t0) * 1000)},
            "error": str(exc),
        }
