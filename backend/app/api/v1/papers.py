"""Papers API - Sprint 4 (durable lookup) + Sprint 5 (AI analysis)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
import json

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.paper import Paper
from app.services.paper_db_service import get_paper
from app.schemas.search import PaperSchema, SummarySchema
from app.workers.analyze_paper import analyze_paper_task

router = APIRouter()


def _paper_to_schema(paper: Paper) -> PaperSchema:
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
        summary=SummarySchema(**json.loads(paper.summary or "{}")),
        gaps=json.loads(paper.gaps or "[]"),
        future=json.loads(paper.future or "[]"),
        analysis_status=paper.analysis_status,
    )


@router.get("/{paper_id}", response_model=PaperSchema)
async def get_paper_by_id(
    paper_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PaperSchema:
    """Retrieve a saved paper by its ID, including analysis status and results."""
    paper = await get_paper(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper '{paper_id}' not found. It may not have been saved to a workspace yet.",
        )
    return _paper_to_schema(paper)


@router.post("/{paper_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def analyze_paper_endpoint(
    paper_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Kick off AI analysis for a saved paper. Idempotent.

    If analysis is already queued, running, or done, this just reports
    current status instead of re-queuing a duplicate Celery job.
    """
    paper = await get_paper(db, paper_id)
    if not paper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper '{paper_id}' not found. Save it to a workspace first.",
        )

    if paper.analysis_status in ("queued", "running", "done"):
        return {"status": paper.analysis_status}

    paper.analysis_status = "queued"
    await db.commit()

    analyze_paper_task.delay(paper_id)

    return {"status": "queued"}