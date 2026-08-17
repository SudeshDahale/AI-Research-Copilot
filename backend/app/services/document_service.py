"""Document service - Sprint 8. Ownership always flows through the parent
workspace, same pattern as workspace_service.py."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.services.workspace_service import get_workspace


async def create_document(
    db: AsyncSession, *, workspace_id: uuid.UUID, title: str, kind: str, prompt: str, user_id: uuid.UUID
) -> Document | None:
    """Insert a pending document row. Returns None if the workspace isn't
    owned by this user - caller should 404."""
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return None

    doc = Document(workspace_id=workspace_id, title=title, kind=kind, prompt=prompt, status="pending")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_document(db: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
    """Fetch a document, checking ownership through its parent workspace."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        return None

    workspace = await get_workspace(db, doc.workspace_id, user_id)
    if not workspace:
        return None
    return doc


async def list_for_workspace(db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> list[Document]:
    workspace = await get_workspace(db, workspace_id, user_id)
    if not workspace:
        return []

    stmt = select(Document).where(Document.workspace_id == workspace_id).order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_document(db: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    doc = await get_document(db, document_id, user_id)
    if not doc:
        return False
    await db.delete(doc)
    await db.commit()
    return True


# --- Status transitions, used by the Celery task (no ownership check needed -
#     the worker isn't acting on behalf of a specific HTTP request) ---

async def mark_processing(db: AsyncSession, document_id: uuid.UUID) -> None:
    doc = await db.get(Document, document_id)
    if doc:
        doc.status = "processing"
        await db.commit()


async def mark_done(db: AsyncSession, document_id: uuid.UUID, content: str) -> None:
    doc = await db.get(Document, document_id)
    if doc:
        doc.content = content
        doc.status = "done"
        await db.commit()


async def mark_failed(db: AsyncSession, document_id: uuid.UUID, error: str) -> None:
    doc = await db.get(Document, document_id)
    if doc:
        doc.status = "failed"
        doc.error = error
        await db.commit()