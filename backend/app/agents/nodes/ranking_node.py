"""Ranking node - Sprint 7. Reuses Sprint 6's ranking_service directly."""
from __future__ import annotations

from app.agents.state import AgentState
from app.core.logging import logger
from app.services import ranking_service, vector_service


async def ranking_node(state: AgentState) -> dict:
    query_embedding = None
    try:
        query_embedding = await vector_service.embed_text(state["query"], input_type="query")
    except Exception as exc:
        logger.warning(f"ranking_node: embed_text failed, falling back to lexical ranking: {exc}")

    ranked = ranking_service.rank_papers(state["query"], state["papers"], query_embedding)
    return {"ranked_papers": ranked}