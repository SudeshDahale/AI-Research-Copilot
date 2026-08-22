"""Deep Pipeline — Agent Engine for In-Depth Scientific Research.

Runs the multi-step LangGraph agent across the broader corpus asynchronously.
Emits intermediate refinement stages and produces the final comprehensive synthesis.
"""
from __future__ import annotations

import time
from typing import Any, AsyncIterator

from app.agents.graph import agent_graph
from app.core.logging import logger

_ANALYZE_LABELS = {
    "summary": "Synthesizing full corpus summary",
    "gaps": "Identifying deep research gaps",
    "compare": "Comparing methodologies and benchmarks",
    "contradictions": "Analyzing contradictions and nuances",
    "review": "Drafting structured literature review",
}


async def run_deep_pipeline(
    query: str,
    intent: str,
    workspace_id: str | None = None,
    papers: list[dict[str, Any]] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Execute the deep pipeline graph asynchronously.
    
    Yields progress events:
      {"type": "refining", "stage": node_name, "message": label}
      {"type": "completed", "final_text": text, "metrics": {...}}
    """
    t0 = time.monotonic()
    
    initial_state = {
        "query": query,
        "intent": intent,
        "workspace_id": workspace_id,
        "papers": papers or [],
        "metrics": {"deep_start_ms": round(time.monotonic() * 1000)},
    }
    
    final_text = ""
    metrics = {}
    
    try:
        async for event in agent_graph.astream(initial_state):
            for node_name, partial_state in event.items():
                if node_name in _ANALYZE_LABELS:
                    yield {
                        "type": "refining",
                        "stage": node_name,
                        "message": _ANALYZE_LABELS[node_name],
                    }
                elif node_name == "compose":
                    final_text = partial_state.get("final_text", "")
                    metrics = partial_state.get("metrics") or {}
                    
        total_ms = round((time.monotonic() - t0) * 1000)
        yield {
            "type": "completed",
            "final_text": final_text,
            "metrics": {**metrics, "deep_total_ms": total_ms},
        }
    except Exception as exc:
        logger.error(f"deep_pipeline execution error: {exc}", exc_info=True)
        yield {
            "type": "error",
            "message": str(exc),
        }
