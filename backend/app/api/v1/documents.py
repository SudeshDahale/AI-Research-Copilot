"""Documents API - Sprint 8."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentOut
from app.services import document_service
from app.workers.generate_document import generate_document_task, run_document_generation_job
from app.core.logging import logger

router = APIRouter()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentOut:
    """Enqueue a document generation job. Returns immediately with status
    'pending' - poll GET /documents/{id} (or list via
    GET /workspaces/{id}/documents) to see when it's done.

    Falls back to in-process background worker if Redis is offline or disconnected."""
    doc = await document_service.create_document(
        db,
        workspace_id=payload.workspace_id,
        title=payload.title,
        kind=payload.kind,
        prompt=payload.prompt,
        user_id=current_user.id,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )

    # 1. Try Celery over Redis
    enqueued = False
    try:
        generate_document_task.delay(str(doc.id))
        enqueued = True
        logger.info(f"Enqueued generate_document_task via Celery/Redis for document_id={doc.id}")
    except Exception as exc:
        logger.warning(f"Celery/Redis enqueue unavailable ({exc}) — falling back to FastAPI BackgroundTasks")

    # 2. Fallback if Redis is down or disconnected
    if not enqueued:
        background_tasks.add_task(run_document_generation_job, str(doc.id))
        logger.info(f"Enqueued document generation via BackgroundTasks fallback for document_id={doc.id}")

    return doc


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentOut:
    doc = await document_service.get_document(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    success = await document_service.delete_document(db, document_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
