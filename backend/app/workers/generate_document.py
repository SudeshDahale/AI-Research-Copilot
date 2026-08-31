"""Celery task & Background worker: run agent graph and persist the result to a
Document row. Runs in background via Celery or FastAPI BackgroundTasks fallback
so generation survives Redis disconnects and tab closes."""
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
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_generate_async(document_id))
            else:
                loop.run_until_complete(_generate_async(document_id))
        except RuntimeError:
            asyncio.run(_generate_async(document_id))
    except Exception as exc:
        logger.error(f"generate_document_task failed for document_id={document_id}: {exc}", exc_info=True)
        try:
            asyncio.run(_mark_failed_async(document_id, str(exc)))
        except Exception:
            pass


async def run_document_generation_job(document_id: str) -> None:
    """Async entrypoint used directly by FastAPI BackgroundTasks when Redis/Celery is offline."""
    try:
        await _generate_async(document_id)
    except Exception as exc:
        logger.error(f"run_document_generation_job failed for document_id={document_id}: {exc}", exc_info=True)
        await _mark_failed_async(document_id, str(exc))


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

    try:
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
    except Exception as exc:
        logger.error(f"agent_graph execution failed for document_id={document_id}: {exc}", exc_info=True)
        await _mark_failed_async(document_id, str(exc))


async def _mark_failed_async(document_id: str, error: str) -> None:
    try:
        async with AsyncSessionLocal() as db:
            await document_service.mark_failed(db, uuid.UUID(document_id), error)
    except Exception as exc:
        logger.error(f"Failed to mark document as failed: {exc}")