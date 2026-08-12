from __future__ import annotations

import uuid
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workspace import Workspace, WorkspacePaper
from app.schemas.workspace import WorkspaceCreate


async def get_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> Workspace | None:
    """Retrieve a workspace by ID, ensuring it belongs to the current user."""
    stmt = (
        select(Workspace)
        .where(Workspace.id == workspace_id, Workspace.user_id == user_id)
        .options(selectinload(Workspace.workspace_papers))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_workspaces(db: AsyncSession, user_id: uuid.UUID) -> list[Workspace]:
    """List all workspaces owned by the user, preloading papers."""
    stmt = (
        select(Workspace)
        .where(Workspace.user_id == user_id)
        .options(selectinload(Workspace.workspace_papers))
        .order_by(Workspace.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_workspace(
    db: AsyncSession, obj_in: WorkspaceCreate, user_id: uuid.UUID
) -> Workspace:
    """Create a new workspace and add any initial paper IDs."""
    db_obj = Workspace(
        name=obj_in.name,
        user_id=user_id,
    )
    db.add(db_obj)
    await db.flush()  # Generate db_obj.id

    if obj_in.paper_ids:
        # Add initial papers
        for paper_id in set(obj_in.paper_ids):
            db.add(WorkspacePaper(workspace_id=db_obj.id, paper_id=paper_id))

    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def rename_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, name: str, user_id: uuid.UUID
) -> Workspace | None:
    """Rename a workspace if it belongs to the user."""
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return None

    workspace.name = name
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Delete a workspace if it belongs to the user."""
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return False

    await db.delete(workspace)
    await db.commit()
    return True


async def add_papers_to_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, paper_ids: list[str], user_id: uuid.UUID
) -> Workspace | None:
    """Add multiple paper IDs to a workspace, ignoring duplicates."""
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return None

    existing_papers = {wp.paper_id for wp in workspace.workspace_papers}
    new_papers = set(paper_ids) - existing_papers

    for paper_id in new_papers:
        db.add(WorkspacePaper(workspace_id=workspace_id, paper_id=paper_id))

    await db.commit()
    await db.refresh(workspace)
    return workspace


async def remove_paper_from_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, paper_id: str, user_id: uuid.UUID
) -> Workspace | None:
    """Remove a paper ID from a workspace."""
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return None

    stmt = delete(WorkspacePaper).where(
        WorkspacePaper.workspace_id == workspace_id,
        WorkspacePaper.paper_id == paper_id,
    )
    await db.execute(stmt)
    await db.commit()
    await db.refresh(workspace)
    return workspace
