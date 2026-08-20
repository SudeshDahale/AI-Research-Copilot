"""Retrieve node — Sprint 8.

Strict workspace isolation rules:
  - workspace_id given  → load that workspace's papers from DB only.
                          NEVER fall back to external search on DB error or empty result.
  - workspace_id absent → external search is allowed.

Embeddings are stripped before returning so they never reach LLM nodes.
"""
from __future__ import annotations

import json
import time
import uuid

from sqlalchemy import select

from app.agents.state import AgentState
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.models.paper import Paper
from app.models.workspace import WorkspacePaper
from app.services import paper_service


# Fields sent to LLM nodes — embeddings intentionally excluded.
_LLM_FIELDS = ("id", "title", "abstract", "authors", "year", "journal", "citations", "tags")


def _paper_to_dict(paper: Paper) -> dict:
    d = {
        "id": str(paper.id),
        "title": paper.title or "",
        "abstract": paper.abstract or "",
        "authors": json.loads(paper.authors or "[]"),
        "year": paper.year,
        "journal": paper.journal or "",
        "citations": paper.citations or 0,
        "tags": json.loads(paper.tags or "[]"),
    }
    return d


def _strip_embeddings(papers: list[dict]) -> list[dict]:
    """Return paper dicts without embedding vectors."""
    return [{k: v for k, v in p.items() if k != "embedding"} for p in papers]


async def retrieve_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    workspace_id = state.get("workspace_id")
    papers: list[dict] = []

    if workspace_id:
        # ── Workspace-scoped request ─────────────────────────────────────────
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

            logger.info(f"retrieve_node: loaded {len(papers)} papers from workspace {workspace_id}")
        except Exception as exc:
            # DB failure — do NOT fall through to external search.
            logger.error(f"retrieve_node: DB error loading workspace {workspace_id}: {exc}")
            elapsed = round((time.monotonic() - t0) * 1000)
            return {
                "papers": [],
                "error": f"Could not load workspace papers: {exc}",
                "metrics": {"db_ms": elapsed},
            }

        if not papers:
            # Empty workspace — do NOT fall through to external search.
            elapsed = round((time.monotonic() - t0) * 1000)
            return {
                "papers": [],
                "error": "empty_workspace",
                "metrics": {"db_ms": elapsed},
            }

        elapsed = round((time.monotonic() - t0) * 1000)
        return {"papers": papers, "metrics": {"db_ms": elapsed}}

    # ── Global request — external search allowed ─────────────────────────────
    query = state.get("query", "")
    try:
        raw = await paper_service.search_papers(query, limit=15)
        papers = _strip_embeddings(raw) if raw and isinstance(raw[0], dict) else raw
        logger.info(f"retrieve_node: external search returned {len(papers)} papers")
    except Exception as exc:
        logger.warning(f"retrieve_node: external search failed: {exc}")
        papers = []

    elapsed = round((time.monotonic() - t0) * 1000)
    return {"papers": papers, "metrics": {"search_ms": elapsed}}
