"""Papers API — Sprint 4.

Provides a durable lookup for papers that have been saved to a workspace.
Search results are ephemeral (Redis cache); this endpoint proves they survive
even after the cache expires.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
import json

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.paper_db_service import get_paper
from app.schemas.search import PaperSchema

router = APIRouter()


@router.get("/{paper_id}", response_model=PaperSchema)
async def get_paper_by_id(
    paper_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaperSchema:
    """Retrieve a saved paper by its ID.

    Returns the durable database row for a paper that has been added to at
    least one workspace.  Returns 404 if the paper has never been saved
    (i.e. it only exists in ephemeral search cache or has expired from it).
    """
    paper = await get_paper(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper '{paper_id}' not found. It may not have been saved to a workspace yet.",
        )

    # Deserialise JSON-encoded list fields before returning
    return PaperSchema(
        id=paper.id,
        title=paper.title,
        abstract=paper.abstract,
        authors=json.loads(paper.authors or "[]"),
        year=paper.year,
        journal=paper.journal,
        citations=paper.citations,
        doi=paper.doi,
        pdf_url=paper.pdf_url,
        tags=json.loads(paper.tags or "[]"),
    )
