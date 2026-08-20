"""Agent API — Sprint 8.

POST /agent/run streams granular SSE events:
  thinking   — intent detected, about to start
  retrieving — loading papers from DB / external search
  analyzing  — LLM analysis node running
  token      — streamed LLM token chunk (where supported)
  completed  — final answer ready
  error      — error message

Uses router.detect_intent() for intent classification (not the old detect_task()).
"""
from __future__ import annotations

import json
import time
from typing import Annotated

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.agent import AgentRunRequest
from app.agents.graph import agent_graph
from app.agents.router import detect_intent
from app.core.logging import logger

router = APIRouter()

# Human-readable labels for SSE "analyzing" events (per node name in graph)
_ANALYZE_LABELS = {
    "summary": "Synthesizing corpus summary",
    "gaps": "Identifying research gaps",
    "compare": "Comparing methodologies",
    "contradictions": "Detecting contradictions",
    "review": "Drafting literature review",
}


def _sse(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data)}


@router.post("/run")
async def run_agent(
    body: AgentRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    async def event_stream():
        t_start = time.monotonic()

        # ── 1. Intent classification (fast — rules or small LLM) ─────────────
        try:
            intent = await detect_intent(body.query)
        except Exception as exc:
            logger.warning(f"detect_intent failed: {exc}")
            intent = "generic"

        yield _sse("thinking", {
            "intent": intent,
            "message": f"Understood as: **{intent.replace('_', ' ').title()}**",
        })

        # ── 2. Build initial graph state ──────────────────────────────────────
        initial_state = {
            "query": body.query,
            "workspace_id": body.workspace_id,
            "intent": intent,
            "metrics": {"intent_ms": round((time.monotonic() - t_start) * 1000)},
        }

        # ── 3. Stream graph node events ───────────────────────────────────────
        try:
            async for event in agent_graph.astream(initial_state):
                for node_name, partial_state in event.items():

                    if node_name == "retrieve":
                        paper_count = len(partial_state.get("papers") or [])
                        ws_id = body.workspace_id
                        source = f"workspace ({paper_count} papers)" if ws_id else f"search ({paper_count} results)"
                        yield _sse("retrieving", {
                            "source": source,
                            "paper_count": paper_count,
                            "message": f"Loaded {paper_count} papers from {source}",
                        })

                        # Surface workspace errors immediately
                        if partial_state.get("error"):
                            err = partial_state["error"]
                            if err == "empty_workspace":
                                yield _sse("error", {
                                    "code": "empty_workspace",
                                    "message": "This workspace has no papers yet. Add papers first.",
                                })
                            else:
                                yield _sse("error", {"message": err})

                    elif node_name in _ANALYZE_LABELS:
                        yield _sse("analyzing", {
                            "node": node_name,
                            "message": _ANALYZE_LABELS[node_name],
                        })

                    elif node_name == "compose":
                        final_text = partial_state.get("final_text", "")
                        metrics = partial_state.get("metrics") or {}
                        total_ms = round((time.monotonic() - t_start) * 1000)

                        yield _sse("completed", {
                            "text": final_text,
                            "metrics": {**metrics, "total_ms": total_ms},
                        })

        except Exception as exc:
            logger.error(f"Agent run failed: {exc}", exc_info=True)
            yield _sse("error", {"message": str(exc)})

    return EventSourceResponse(event_stream())