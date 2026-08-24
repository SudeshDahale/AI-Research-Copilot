"""Celery task: run Sprint 7's agent graph and persist the result to a
Document row. Runs entirely in the background - the HTTP request that
enqueued this returns immediately, and the frontend polls GET /documents/{id}
for status. This is what makes generation survive closing the tab."""
from __future__ import annotations

import asyncio
import uuid

from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.core.logging import logger
from app.services import document_service
from app.agents.graph import agent_graph
from app.models.document import Document

KIND_TO_TASK = {
    "Literature review": "literature_review",
    "Report": "literature_review",
    "Brief": "literature_review",
    "Outline": "literature_review",
    "Summary": "summary",
}


@celery_app.task(name="generate_document", bind=True, max_retries=1)
def generate_document_task(self, document_id: str) -> None:
    try:
        asyncio.run(_generate_async(document_id))
    except Exception as exc:
        logger.error(f"generate_document_task failed for document_id={document_id}: {exc}")
        asyncio.run(_mark_failed_async(document_id, str(exc)))


async def _generate_async(document_id: str) -> None:
    doc_uuid = uuid.UUID(document_id)

    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, doc_uuid)
        if doc is None:
            logger.warning(f"generate_document_task: document {document_id!r} not found, skipping")
            return

        await document_service.mark_processing(db, doc_uuid)
        workspace_id = str(doc.workspace_id)
        prompt = doc.prompt or doc.title
        intent = KIND_TO_TASK.get(doc.kind, "literature_review")

    initial_state = {
        "query": prompt,
        "workspace_id": workspace_id,
        "intent": intent,
        "task": intent,
    }
    final_state = await agent_graph.ainvoke(initial_state)
    final_text = final_state.get("final_text", "")

    async with AsyncSessionLocal() as db:
        await document_service.mark_done(db, doc_uuid, final_text)
        logger.info(f"generate_document_task: completed document_id={document_id}")


async def _mark_failed_async(document_id: str, error: str) -> None:
    async with AsyncSessionLocal() as db:
        await document_service.mark_failed(db, uuid.UUID(document_id), error)