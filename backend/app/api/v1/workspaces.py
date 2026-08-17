from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspacePaperAdd,
    WorkspaceOut,
)
from app.services import workspace_service
from app.services import vector_service
from app.services import document_service
from app.schemas.document import DocumentOut


router = APIRouter()


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceOut]:
    """Retrieve all workspaces owned by the current user."""
    return await workspace_service.list_workspaces(
        db,
        user_id=current_user.id,
    )


@router.post(
    "",
    response_model=WorkspaceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace(
    payload: WorkspaceCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Create a new workspace for the current user."""
    workspace = await workspace_service.create_workspace(
        db,
        obj_in=payload,
        user_id=current_user.id,
    )
    for paper_id in payload.paper_ids:
        background_tasks.add_task(
            vector_service.embed_paper_by_id,
            paper_id,
        )
    return workspace


@router.put("/{id}", response_model=WorkspaceOut)
async def rename_workspace(
    id: uuid.UUID,
    payload: WorkspaceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Rename a workspace owned by the current user."""
    workspace = await workspace_service.rename_workspace(
        db,
        workspace_id=id,
        name=payload.name,
        user_id=current_user.id,
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )

    return workspace


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a workspace owned by the current user."""
    success = await workspace_service.delete_workspace(
        db,
        workspace_id=id,
        user_id=current_user.id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )


@router.post("/{id}/papers", response_model=WorkspaceOut)
async def add_papers_to_workspace(
    id: uuid.UUID,
    payload: WorkspacePaperAdd,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Add paper IDs to a workspace owned by the current user.

    If papers_data is included in the request body, each paper's metadata
    is upserted into the durable papers table.

    Newly saved papers are embedded in the background (Sprint 6) so
    "similar papers" and semantic search ranking can use their embeddings.
    """
    workspace = await workspace_service.add_papers_to_workspace(
        db,
        workspace_id=id,
        paper_ids=payload.paper_ids,
        user_id=current_user.id,
        papers_data=payload.papers_data or None,
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )

    # Sprint 6:
    # Generate embeddings in the background for newly saved papers.
    for paper_id in payload.paper_ids:
        background_tasks.add_task(
            vector_service.embed_paper_by_id,
            paper_id,
        )

    return workspace


@router.delete(
    "/{id}/papers/{paper_id}",
    response_model=WorkspaceOut,
)
async def remove_paper_from_workspace(
    id: uuid.UUID,
    paper_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Remove a paper ID from a workspace owned by the current user."""
    workspace = await workspace_service.remove_paper_from_workspace(
        db,
        workspace_id=id,
        paper_id=paper_id,
        user_id=current_user.id,
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )

    return workspace


@router.get("/{id}/documents", response_model=list[DocumentOut])
async def list_workspace_documents(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DocumentOut]:
    """List all generated documents for a workspace, most recent first.

    Sprint 8: documents live in Postgres and are generated by a Celery worker.
    This is the canonical endpoint polled by useDocuments() on the frontend.
    """
    return await document_service.list_for_workspace(db, id, current_user.id)