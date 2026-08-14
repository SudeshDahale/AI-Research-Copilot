from fastapi import APIRouter, Depends
from typing import Annotated
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.search import SearchRequest, PaperSchema
from app.services.paper_service import search_papers
from app.services.ranking_service import rank_papers
from app.core.cache import cached_search
from app.core.logging import logger

router = APIRouter()


@router.post("", response_model=list[PaperSchema])
async def search(
    payload: SearchRequest,
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> list[dict]:
    """Search and rank papers across arXiv and Semantic Scholar.

    Results are cached in Redis for a short TTL (5 min by default).  A second
    identical query within that window skips the external API calls entirely —
    you'll see "Cache HIT" vs "Cache MISS" in the server logs (Sprint 4 DoD).
    """
    query = payload.query.strip()
    if not query:
        return []

    user_info = f"User: {current_user.email}" if current_user else "Guest"
    logger.info(f"Search request received. Query: '{query}' ({user_info})")

    # Fetch raw papers — hits Redis first, falls back to external APIs on miss
    raw_papers, from_cache = await cached_search(query, search_papers)
    logger.info(f"Search for '{query}': {'cache HIT' if from_cache else 'cache MISS'}, {len(raw_papers)} raw results")

    # Always re-rank (ranking is cheap CPU work, no need to cache separately)
    ranked = rank_papers(query, raw_papers)

    return ranked
