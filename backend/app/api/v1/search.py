from fastapi import APIRouter, Depends
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.search import SearchRequest, PaperSchema
from app.services.paper_service import search_papers
from app.services.ranking_service import rank_papers
from app.services import vector_service
from app.core.cache import cached_search
from app.core.logging import logger

router = APIRouter()


@router.post("", response_model=list[PaperSchema])
async def search(
    payload: SearchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> list[dict]:
    """Search and rank papers across arXiv and Semantic Scholar.

    Results are cached in Redis for a short TTL (Sprint 4). Ranking now also
    blends in semantic similarity (Sprint 6) for any result that happens to
    already be a saved, embedded paper — fresh/unsaved results still rank on
    lexical + recency + impact alone, since embedding every raw search result
    on every query would be slow and expensive for no real benefit.
    """
    query = payload.query.strip()
    if not query:
        return []

    user_info = f"User: {current_user.email}" if current_user else "Guest"
    logger.info(f"Search request received. Query: '{query}' ({user_info})")

    raw_papers, from_cache = await cached_search(query, search_papers)
    logger.info(f"Search for '{query}': {'cache HIT' if from_cache else 'cache MISS'}, {len(raw_papers)} raw results")

    # One embedding call for the query itself; returns None gracefully if
    # VOYAGE_API_KEY isn't set.
    query_embedding = await vector_service.embed_text(query, input_type="query")

    # Attach stored embeddings for any result that's already a saved paper.
    ids = [p["id"] for p in raw_papers if p.get("id")]
    embeddings_by_id = await vector_service.get_embeddings_for_ids(db, ids) if ids else {}
    for p in raw_papers:
        if p["id"] in embeddings_by_id:
            p["embedding"] = embeddings_by_id[p["id"]]

    ranked = rank_papers(query, raw_papers, query_embedding)
    return ranked