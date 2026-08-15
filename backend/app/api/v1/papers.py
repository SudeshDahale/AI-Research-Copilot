"""Papers API - Sprint 4 (durable lookup) + Sprint 5 (AI analysis) + Sprint 6 (similar papers)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
import json

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.paper import Paper
from app.services.paper_db_service import get_paper
from app.services import vector_service
from app.schemas.search import PaperSchema, SummarySchema

router = APIRouter()


def _paper_to_schema(paper: Paper) -> PaperSchema:
    # getattr(..., default) here because summary/gaps/future/analysis_status
    # are Sprint 5 columns that don't exist on the model yet in this repo —
    # this keeps Sprint 6 from crashing on that gap. Once Sprint 5 adds real
    # columns, swap these back to plain paper.summary / paper.gaps / etc.
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
        summary=SummarySchema(**json.loads(getattr(paper, "summary", None) or "{}")),
        gaps=json.loads(getattr(paper, "gaps", None) or "[]"),
        future=json.loads(getattr(paper, "future", None) or "[]"),
    )


@router.get("/{paper_id}", response_model=PaperSchema)
async def get_paper_by_id(
    paper_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaperSchema:
    """Retrieve a saved paper by its ID."""
    paper = await get_paper(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper '{paper_id}' not found. It may not have been saved to a workspace yet.",
        )
    return _paper_to_schema(paper)


@router.get("/{paper_id}/similar", response_model=list[PaperSchema])
async def get_similar_papers(
    paper_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 5,
) -> list[PaperSchema]:
    """Sprint 6 — semantically similar papers, via pgvector cosine distance.

    Embeds this paper on the fly if it doesn't have a vector yet (first call
    is slower; every call after is instant). Only compares against other
    papers that have already been embedded, so results improve as your
    library grows.
    """
    paper = await get_paper(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper '{paper_id}' not found. Save it to a workspace first.",
        )

    similar = await vector_service.find_similar_papers(db, paper, limit=limit)

    results = []
    for similar_paper, score in similar:
        schema = _paper_to_schema(similar_paper)
        schema.relevance = score
        results.append(schema)
    return results