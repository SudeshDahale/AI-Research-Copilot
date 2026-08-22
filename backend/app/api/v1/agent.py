"""Agent API — Chat Optimization & Dual Pipeline Architecture.

POST /agent/run streams granular SSE events:
  thinking          — intent detected, about to start
  retrieving        — loading papers from DB / external search
  token             — fast pipeline LLM token chunk (real-time stream)
  fast_completed    — instant fast answer ready (1-2s)
  refining          — background deep pipeline node/stage running
  refined_completed — comprehensive deep research synthesis ready
  completed         — legacy compatibility final event
  error             — error message
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
from app.agents.nodes.retrieve import retrieve_node
from app.agents.fast_pipeline import stream_fast_pipeline
from app.agents.deep_pipeline import run_deep_pipeline
from app.agents.router import detect_intent
from app.core.logging import logger

router = APIRouter()


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

        # ── 2. Paper retrieval ───────────────────────────────────────────────
        retrieval_state = await retrieve_node({
            "query": body.query,
            "workspace_id": body.workspace_id,
            "intent": intent,
        })

        papers = retrieval_state.get("papers", [])
        error = retrieval_state.get("error")
        paper_count = len(papers)
        ws_id = body.workspace_id
        source = f"workspace ({paper_count} papers)" if ws_id else f"search ({paper_count} results)"

        yield _sse("retrieving", {
            "source": source,
            "paper_count": paper_count,
            "message": f"Loaded {paper_count} papers from {source}",
        })

        # Surface workspace errors immediately
        if error:
            if error == "empty_workspace":
                yield _sse("error", {
                    "code": "empty_workspace",
                    "message": "This workspace has no papers yet. Add papers first.",
                })
            else:
                yield _sse("error", {"message": error})
            return

        # ── 3. Fast Pipeline: Real-time token streaming (1-2s UX) ───────────
        fast_accumulated = []
        try:
            async for token in stream_fast_pipeline(body.query, papers, intent=intent):
                fast_accumulated.append(token)
                yield _sse("token", {"chunk": token})
        except Exception as exc:
            logger.warning(f"Fast pipeline streaming error: {exc}")

        fast_text = "".join(fast_accumulated).strip()
        fast_ms = round((time.monotonic() - t_start) * 1000)

        yield _sse("fast_completed", {
            "text": fast_text,
            "metrics": {"fast_ms": fast_ms},
        })

        # ── 4. Deep Pipeline: Agent reasoning across full corpus ─────────────
        deep_final_text = ""
        try:
            async for event in run_deep_pipeline(
                query=body.query,
                intent=intent,
                workspace_id=body.workspace_id,
                papers=papers,
            ):
                if event["type"] == "refining":
                    yield _sse("refining", {
                        "stage": event.get("stage"),
                        "message": event.get("message"),
                    })
                elif event["type"] == "completed":
                    deep_final_text = event.get("final_text") or fast_text
                    total_ms = round((time.monotonic() - t_start) * 1000)
                    yield _sse("refined_completed", {
                        "text": deep_final_text,
                        "metrics": {**(event.get("metrics") or {}), "total_ms": total_ms},
                    })
                elif event["type"] == "error":
                    logger.warning(f"Deep pipeline returned error: {event.get('message')}")
        except Exception as exc:
            logger.error(f"Deep pipeline run error: {exc}", exc_info=True)

        # Fallback compatibility event for clients listening to 'completed'
        final_answer = deep_final_text or fast_text
        yield _sse("completed", {
            "text": final_answer,
            "metrics": {"total_ms": round((time.monotonic() - t_start) * 1000)},
        })

    return EventSourceResponse(event_stream())