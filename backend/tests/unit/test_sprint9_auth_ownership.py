"""Sprint 9: Auth Hardening, Resource Ownership & Rate Limiting Unit Tests."""
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

from app.main import app
from app.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.document import Document
from app.core.rate_limit import RateLimiter, _memory_rate_limit_store


@pytest.mark.asyncio
async def test_workspace_resource_ownership_isolation():
    user_a = User(id=uuid.uuid4(), email="usera@example.com", name="User A")
    user_b = User(id=uuid.uuid4(), email="userb@example.com", name="User B")

    now = datetime.now(timezone.utc)
    ws_a_id = uuid.uuid4()
    ws_a = Workspace(
        id=ws_a_id,
        user_id=user_a.id,
        name="User A Private Workspace",
        created_at=now,
        updated_at=now,
    )

    async def mock_get_workspace(db, workspace_id, user_id):
        if workspace_id == ws_a_id and user_id == user_a.id:
            return ws_a
        return None

    async def mock_rename_workspace(db, workspace_id, name, user_id):
        if workspace_id == ws_a_id and user_id == user_a.id:
            ws_a.name = name
            return ws_a
        return None

    async def mock_delete_workspace(db, workspace_id, user_id):
        return workspace_id == ws_a_id and user_id == user_a.id

    async def mock_add_papers(db, workspace_id, paper_ids, user_id, papers_data=None):
        if workspace_id == ws_a_id and user_id == user_a.id:
            return ws_a
        return None

    async def mock_remove_paper(db, workspace_id, paper_id, user_id):
        if workspace_id == ws_a_id and user_id == user_a.id:
            return ws_a
        return None

    transport = ASGITransport(app=app)

    with (
        patch("app.services.workspace_service.get_workspace", side_effect=mock_get_workspace),
        patch("app.services.workspace_service.rename_workspace", side_effect=mock_rename_workspace),
        patch("app.services.workspace_service.delete_workspace", side_effect=mock_delete_workspace),
        patch("app.services.workspace_service.add_papers_to_workspace", side_effect=mock_add_papers),
        patch("app.services.workspace_service.remove_paper_from_workspace", side_effect=mock_remove_paper),
    ):
        # 1. User A can view their own workspace
        app.dependency_overrides[get_current_user] = lambda: user_a
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/workspaces/{ws_a_id}")
            assert res.status_code == 200
            assert res.json()["name"] == "User A Private Workspace"

        # 2. User B cannot view User A's workspace (404)
        app.dependency_overrides[get_current_user] = lambda: user_b
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/workspaces/{ws_a_id}")
            assert res.status_code == 404

            # 3. User B cannot rename User A's workspace (404)
            res = await client.put(f"/api/v1/workspaces/{ws_a_id}", json={"name": "Hacked"})
            assert res.status_code == 404

            # 4. User B cannot delete User A's workspace (404)
            res = await client.delete(f"/api/v1/workspaces/{ws_a_id}")
            assert res.status_code == 404

            # 5. User B cannot add papers to User A's workspace (404)
            res = await client.post(f"/api/v1/workspaces/{ws_a_id}/papers", json={"paper_ids": ["p1"]})
            assert res.status_code == 404

            # 6. User B cannot remove papers from User A's workspace (404)
            res = await client.delete(f"/api/v1/workspaces/{ws_a_id}/papers/p1")
            assert res.status_code == 404

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_document_resource_ownership_isolation():
    user_a = User(id=uuid.uuid4(), email="usera@example.com", name="User A")
    user_b = User(id=uuid.uuid4(), email="userb@example.com", name="User B")

    now = datetime.now(timezone.utc)
    ws_a_id = uuid.uuid4()
    doc_a_id = uuid.uuid4()
    doc_a = Document(
        id=doc_a_id,
        workspace_id=ws_a_id,
        title="User A Doc",
        kind="Summary",
        prompt="Summarize",
        status="done",
        content="Private content",
        created_at=now,
        updated_at=now,
    )

    async def mock_get_document(db, document_id, user_id):
        if document_id == doc_a_id and user_id == user_a.id:
            return doc_a
        return None

    async def mock_delete_document(db, document_id, user_id):
        return document_id == doc_a_id and user_id == user_a.id

    async def mock_create_document(db, workspace_id, title, kind, prompt, user_id):
        if workspace_id == ws_a_id and user_id == user_a.id:
            return doc_a
        return None

    transport = ASGITransport(app=app)

    with (
        patch("app.services.document_service.get_document", side_effect=mock_get_document),
        patch("app.services.document_service.delete_document", side_effect=mock_delete_document),
        patch("app.services.document_service.create_document", side_effect=mock_create_document),
    ):
        # 1. User A can view their document
        app.dependency_overrides[get_current_user] = lambda: user_a
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/documents/{doc_a_id}")
            assert res.status_code == 200
            assert res.json()["title"] == "User A Doc"

        # 2. User B cannot view User A's document (404)
        app.dependency_overrides[get_current_user] = lambda: user_b
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/documents/{doc_a_id}")
            assert res.status_code == 404

            # 3. User B cannot delete User A's document (404)
            res = await client.delete(f"/api/v1/documents/{doc_a_id}")
            assert res.status_code == 404

            # 4. User B cannot create document in User A's workspace (404)
            res = await client.post("/api/v1/documents", json={
                "workspace_id": str(ws_a_id),
                "title": "Unwanted",
                "kind": "Summary",
                "prompt": "prompt"
            })
            assert res.status_code == 404

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_agent_workspace_ownership_isolation():
    user_a = User(id=uuid.uuid4(), email="usera@example.com", name="User A")
    user_b = User(id=uuid.uuid4(), email="userb@example.com", name="User B")

    ws_a_id = uuid.uuid4()
    ws_a = Workspace(id=ws_a_id, user_id=user_a.id, name="User A Private Workspace")

    async def mock_get_workspace(db, workspace_id, user_id):
        if workspace_id == ws_a_id and user_id == user_a.id:
            return ws_a
        return None

    transport = ASGITransport(app=app)

    with patch("app.services.workspace_service.get_workspace", side_effect=mock_get_workspace):
        # User B tries to run agent on User A's workspace
        app.dependency_overrides[get_current_user] = lambda: user_b
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/agent/run", json={
                "query": "Find gaps",
                "workspace_id": str(ws_a_id)
            })
            assert res.status_code == 200
            assert "workspace_not_found" in res.text

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rate_limiter():
    limiter = RateLimiter(requests_per_minute=2, key_prefix="test_rl")
    user = User(id=uuid.uuid4(), email="test_rl@example.com", name="RL User")

    class DummyRequest:
        client = None
        headers = {}

    req = DummyRequest()
    _memory_rate_limit_store.clear()

    with patch("app.core.rate_limit.get_redis", side_effect=Exception("No Redis in unit test")):
        # Request 1: OK
        await limiter(req, current_user=user)
        # Request 2: OK
        await limiter(req, current_user=user)

        # Request 3: 429 Too Many Requests
        with pytest.raises(Exception) as exc_info:
            await limiter(req, current_user=user)

        assert "Rate limit exceeded" in str(exc_info.value)
