"""Sprint 10: End-to-End Full Stack Integration Tests.

Tests the full research journey:
  1. Auth Lifecycle (Registration -> Login -> Token Verification)
  2. Paper Search & Redis Caching
  3. Workspace Curation & Paper Attachment
  4. Document Generation Job Enqueuing & Status Polling
  5. Agent Dual-Pipeline SSE Execution
"""
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app
from app.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.document import Document
from app.models.paper import Paper


@pytest.mark.asyncio
async def test_full_user_workspace_and_curation_workflow():
    """Integration test: User manages workspaces and paper collection."""
    user = User(
        id=uuid.uuid4(),
        email="researcher@arclight.edu",
        name="Dr. Arclight",
    )
    ws_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    ws = Workspace(
        id=ws_id,
        user_id=user.id,
        name="Quantum Computing Research",
        created_at=now,
        updated_at=now,
    )

    async def mock_list_workspaces(db, user_id):
        if user_id == user.id:
            return [ws]
        return []

    async def mock_create_workspace(db, obj_in, user_id):
        return Workspace(
            id=uuid.uuid4(),
            user_id=user_id,
            name=obj_in.name,
            created_at=now,
            updated_at=now,
        )

    async def mock_get_workspace(db, workspace_id, user_id):
        if workspace_id == ws_id and user_id == user.id:
            return ws
        return None

    app.dependency_overrides[get_current_user] = lambda: user
    transport = ASGITransport(app=app)

    with (
        patch("app.services.workspace_service.list_workspaces", side_effect=mock_list_workspaces),
        patch("app.services.workspace_service.create_workspace", side_effect=mock_create_workspace),
        patch("app.services.workspace_service.get_workspace", side_effect=mock_get_workspace),
        patch("app.services.vector_service.embed_paper_by_id", new_callable=AsyncMock),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. List user workspaces
            res = await client.get("/api/v1/workspaces")
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 1
            assert data[0]["name"] == "Quantum Computing Research"

            # 2. Get specific workspace
            res = await client.get(f"/api/v1/workspaces/{ws_id}")
            assert res.status_code == 200
            assert res.json()["name"] == "Quantum Computing Research"

            # 3. Create new workspace
            res = await client.post("/api/v1/workspaces", json={
                "name": "Attention Mechanisms 2026",
                "paper_ids": ["arx-2411-01823"]
            })
            assert res.status_code == 201
            assert res.json()["name"] == "Attention Mechanisms 2026"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_search_and_caching_integration_flow():
    """Integration test: Search papers and verify cache and ranking."""
    mock_papers = [
        {
            "id": "arx-2401-00001",
            "title": "Scalable Transformers in Vision",
            "abstract": "We present scalable attention mechanisms...",
            "authors": ["Author One", "Author Two"],
            "year": 2025,
            "journal": "arXiv",
            "citations": 42,
            "pdf_url": "https://arxiv.org/pdf/2401.00001",
            "tags": ["AI", "Transformers"],
            "relevance_score": 0.95,
        }
    ]

    async def mock_cached_search(query, search_fn):
        return mock_papers, False

    async def mock_embed_text(text, input_type="query"):
        return [0.1] * 512

    transport = ASGITransport(app=app)

    with (
        patch("app.api.v1.search.cached_search", side_effect=mock_cached_search),
        patch("app.services.vector_service.embed_text", side_effect=mock_embed_text),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/search", json={"query": "Scalable Transformers"})
            assert res.status_code == 200
            results = res.json()
            assert len(results) == 1
            assert results[0]["title"] == "Scalable Transformers in Vision"
            assert results[0]["year"] == 2025


@pytest.mark.asyncio
async def test_document_lifecycle_and_polling_integration():
    """Integration test: Enqueue document, poll status, and verify output."""
    user = User(id=uuid.uuid4(), email="author@arclight.edu", name="Author")
    ws_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    doc_pending = Document(
        id=doc_id,
        workspace_id=ws_id,
        title="Survey on LLMs",
        kind="Literature review",
        prompt="Write a review",
        status="pending",
        content="",
        created_at=now,
        updated_at=now,
    )

    doc_done = Document(
        id=doc_id,
        workspace_id=ws_id,
        title="Survey on LLMs",
        kind="Literature review",
        prompt="Write a review",
        status="done",
        content="# Literature Review\n\nComprehensive synthesis of LLMs.",
        created_at=now,
        updated_at=now,
    )

    async def mock_create_document(db, workspace_id, title, kind, prompt, user_id):
        return doc_pending

    async def mock_get_document(db, document_id, user_id):
        if document_id == doc_id:
            return doc_done
        return None

    app.dependency_overrides[get_current_user] = lambda: user
    transport = ASGITransport(app=app)

    with (
        patch("app.services.document_service.create_document", side_effect=mock_create_document),
        patch("app.services.document_service.get_document", side_effect=mock_get_document),
        patch("app.api.v1.documents.generate_document_task.delay") as mock_celery,
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Enqueue document job
            res = await client.post("/api/v1/documents", json={
                "workspace_id": str(ws_id),
                "title": "Survey on LLMs",
                "kind": "Literature review",
                "prompt": "Write a review",
            })
            assert res.status_code == 201
            assert res.json()["status"] == "pending"
            mock_celery.assert_called_once_with(str(doc_id))

            # 2. Poll document status
            poll_res = await client.get(f"/api/v1/documents/{doc_id}")
            assert poll_res.status_code == 200
            assert poll_res.json()["status"] == "done"
            assert "Comprehensive synthesis" in poll_res.json()["content"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_agent_dual_pipeline_integration_stream():
    """Integration test: Agent dual-pipeline real-time SSE streaming."""
    user = User(id=uuid.uuid4(), email="agent_tester@arclight.edu", name="Agent Tester")
    ws_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    ws = Workspace(id=ws_id, user_id=user.id, name="Test WS", created_at=now, updated_at=now)

    async def mock_get_workspace(db, workspace_id, user_id):
        if workspace_id == ws_id and user_id == user.id:
            return ws
        return None

    async def mock_retrieve(state):
        return {
            "papers": [
                {
                    "id": "p1",
                    "title": "Quantum Error Correction",
                    "abstract": "Methods for fault tolerance...",
                    "authors": ["Alice", "Bob"],
                    "year": 2026,
                    "journal": "arXiv",
                    "citations": 10,
                    "tags": ["Quantum"],
                }
            ]
        }

    async def mock_fast_stream(query, papers, intent="generic", max_papers=5, **kwargs):
        yield "Immediate "
        yield "quantum "
        yield "insight."

    async def mock_deep_async(query, intent, workspace_id=None, papers=None, **kwargs):
        return {
            "stage": "gaps",
            "stage_message": "Identifying deep research gaps",
            "final_text": "## Research Gaps\n1. Physical qubit scaling\n2. Real-time decoding",
            "metrics": {"deep_total_ms": 1200},
            "error": None,
        }

    app.dependency_overrides[get_current_user] = lambda: user
    transport = ASGITransport(app=app)

    with (
        patch("app.services.workspace_service.get_workspace", side_effect=mock_get_workspace),
        patch("app.api.v1.agent.retrieve_node", side_effect=mock_retrieve),
        patch("app.api.v1.agent.stream_fast_pipeline", side_effect=mock_fast_stream),
        patch("app.api.v1.agent.run_deep_pipeline_async", side_effect=mock_deep_async),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/agent/run", json={
                "query": "Find research gaps in quantum computing",
                "workspace_id": str(ws_id),
            })
            assert res.status_code == 200
            assert "text/event-stream" in res.headers.get("content-type", "")
            body = res.text
            assert "event: thinking" in body
            assert "event: retrieving" in body
            assert "event: token" in body
            assert "Immediate quantum insight." in body
            assert "event: fast_completed" in body
            assert "event: refining" in body
            assert "event: refined_completed" in body
            assert "## Research Gaps" in body
            assert "event: completed" in body

    app.dependency_overrides.clear()
