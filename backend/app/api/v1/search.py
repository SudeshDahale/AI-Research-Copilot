from fastapi import APIRouter, Depends
from typing import Annotated
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.search import SearchRequest, PaperSchema
from app.services.paper_service import search_papers
from app.services.ranking_service import rank_papers
from app.core.logging import logger

router = APIRouter()

@router.post("", response_model=list[PaperSchema])
async def search(
    payload: SearchRequest,
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None
) -> list[dict]:
    """Search and rank papers across arXiv and Semantic Scholar."""
    query = payload.query.strip()
    if not query:
        return []

    user_info = f"User: {current_user.email}" if current_user else "Guest"
    logger.info(f"Search request received. Query: '{query}' ({user_info})")

    # Fetch papers from APIs
    raw_papers = await search_papers(query)

    # Rank them server-side using lexical similarity
    ranked = rank_papers(query, raw_papers)

    return ranked
