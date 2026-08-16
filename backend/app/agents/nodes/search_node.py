"""Search node - Sprint 7.

Resolves which papers are "in scope" for this agent run:
  - workspace_id given -> load that workspace's saved papers from Postgres
  - no workspace_id -> run a live search (Sprint 3's paper_service)
"""
from __future__ import annotations
import json
import uuid

from sqlalchemy import select

from app.agents.state import AgentState
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.models.paper import Paper
from app.models.workspace import WorkspacePaper
from app.services import paper_service


def _paper_to_dict(paper: Paper) -> dict:
    return {
        "id": paper.id,
        "title": paper.title,
        "abstract": paper.abstract,
        "authors": json.loads(paper.authors or "[]"),
        "year": paper.year,
        "journal": paper.journal,
        "citations": paper.citations,
        "tags": json.loads(paper.tags or "[]"),
        "embedding": paper.embedding,
    }


async def search_node(state: AgentState) -> dict:
    workspace_id = state.get("workspace_id")
    papers: list[dict] = []

    if workspace_id:
        try:
            ws_uuid = uuid.UUID(str(workspace_id))
            async with AsyncSessionLocal() as db:
                stmt = (
                    select(Paper)
                    .join(WorkspacePaper, WorkspacePaper.paper_id == Paper.id)
                    .where(WorkspacePaper.workspace_id == ws_uuid)
                )
                result = await db.execute(stmt)
                papers = [_paper_to_dict(p) for p in result.scalars().all()]
            logger.info(f"search_node: loaded {len(papers)} papers from workspace {workspace_id}")
            if papers:
                return {"papers": papers}
        except Exception as exc:
            logger.warning(f"search_node: could not load workspace {workspace_id} from DB: {exc}")

    query = state.get("query", "")
    try:
        papers = await paper_service.search_papers(query, limit=15)
        logger.info(f"search_node: live search returned {len(papers)} papers")
    except Exception as exc:
        logger.warning(f"search_node: search fallback failed: {exc}")
        papers = []

    return {"papers": papers}