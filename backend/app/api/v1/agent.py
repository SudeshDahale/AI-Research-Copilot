"""Agent API - Sprint 7. POST /agent/run streams SSE, one event per node."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.agent import AgentRunRequest
from app.agents.graph import agent_graph, detect_task
from app.core.logging import logger

router = APIRouter()

NODE_LABELS = {
    "search": "Reading papers in scope",
    "ranking": "Scoring relevance",
    "clustering": "Clustering findings",
    "summarize": "Synthesizing summary",
    "gap_detection": "Identifying research gaps",
    "lit_review": "Drafting narrative",
    "compose": "Finalizing response",
}


@router.post("/run")
async def run_agent(
    body: AgentRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    async def event_stream():
        task = detect_task(body.query)
        initial_state = {
            "query": body.query,
            "workspace_id": body.workspace_id,
            "task": task,
        }

        try:
            async for event in agent_graph.astream(initial_state):
                for node_name, partial_state in event.items():
                    yield {
                        "event": "step",
                        "data": {
                            "node": node_name,
                            "label": NODE_LABELS.get(node_name, node_name),
                        },
                    }
                    if node_name == "compose":
                        yield {
                            "event": "done",
                            "data": {"text": partial_state.get("final_text", "")},
                        }
        except Exception as exc:
            logger.error(f"Agent run failed: {exc}", exc_info=True)
            yield {"event": "error", "data": {"message": str(exc)}}

    return EventSourceResponse(event_stream())