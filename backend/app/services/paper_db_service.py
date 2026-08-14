"""Paper persistence service.

Papers are only written to the database when a user explicitly saves them to
a workspace.  Search results are ephemeral (Redis TTL); this layer provides
the durable half of that two-lifetime design.
"""
from __future__ import annotations

import json
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper import Paper


async def upsert_paper(db: AsyncSession, paper_data: dict) -> Paper:
    """Insert or update a Paper row from a search-result dict.

    Uses PostgreSQL's ON CONFLICT DO UPDATE so repeated saves of the same
    paper always refresh citation counts, pdf_url, etc. from the latest
    search result, without raising a duplicate-key error.
    """
    paper_id = paper_data.get("id", "")
    if not paper_id:
        raise ValueError("paper_data must contain a non-empty 'id' field")

    values = {
        "id":       paper_id,
        "title":    paper_data.get("title") or "",
        "abstract": paper_data.get("abstract") or "",
        "authors":  json.dumps(paper_data.get("authors") or []),
        "year":     int(paper_data.get("year") or 2024),
        "journal":  paper_data.get("journal") or "",
        "citations": int(paper_data.get("citations") or 0),
        "doi":      paper_data.get("doi") or "",
        "pdf_url":  paper_data.get("pdf_url") or "",
        "tags":     json.dumps(paper_data.get("tags") or []),
    }

    stmt = (
        pg_insert(Paper)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["id"],
            set_={
                "title":     values["title"],
                "abstract":  values["abstract"],
                "authors":   values["authors"],
                "year":      values["year"],
                "journal":   values["journal"],
                "citations": values["citations"],
                "doi":       values["doi"],
                "pdf_url":   values["pdf_url"],
                "tags":      values["tags"],
            },
        )
    )
    await db.execute(stmt)
    await db.flush()

    # Re-fetch the row so we return the full ORM object
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    return result.scalar_one()


async def get_paper(db: AsyncSession, paper_id: str) -> Paper | None:
    """Retrieve a durable paper by its ID, or None if not yet persisted."""
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    return result.scalar_one_or_none()
