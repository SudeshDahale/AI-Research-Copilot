from __future__ import annotations

import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
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

router = APIRouter()


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceOut]:
    """Retrieve all workspaces owned by the current user."""
    return await workspace_service.list_workspaces(db, user_id=current_user.id)


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Create a new workspace for the current user."""
    return await workspace_service.create_workspace(
        db, obj_in=payload, user_id=current_user.id
    )


@router.put("/{id}", response_model=WorkspaceOut)
async def rename_workspace(
    id: uuid.UUID,
    payload: WorkspaceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Rename a workspace owned by the current user."""
    workspace = await workspace_service.rename_workspace(
        db, workspace_id=id, name=payload.name, user_id=current_user.id
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
        db, workspace_id=id, user_id=current_user.id
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Add paper IDs to a workspace owned by the current user."""
    workspace = await workspace_service.add_papers_to_workspace(
        db, workspace_id=id, paper_ids=payload.paper_ids, user_id=current_user.id
    )
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )
    return workspace


@router.delete("/{id}/papers/{paper_id}", response_model=WorkspaceOut)
async def remove_paper_from_workspace(
    id: uuid.UUID,
    paper_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    """Remove a paper ID from a workspace owned by the current user."""
    workspace = await workspace_service.remove_paper_from_workspace(
        db, workspace_id=id, paper_id=paper_id, user_id=current_user.id
    )
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or not owned by the current user",
        )
    return workspace
