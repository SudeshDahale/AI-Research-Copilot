import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app
from app.dependencies import get_current_user
from app.models.user import User


@pytest.mark.asyncio
async def test_agent_run_endpoint_streaming():
    mock_user = User(id="11111111-1111-1111-1111-111111111111", email="test@example.com", name="Test User")

    app.dependency_overrides[get_current_user] = lambda: mock_user

    async def mock_retrieve(state):
        return {"papers": [{"id": "p1", "title": "Test Paper", "abstract": "Test abstract"}]}

    async def mock_fast_stream(query, papers, intent="generic", max_papers=5, **kwargs):
        yield "Fast "
        yield "insight."

    async def mock_deep_async(query, intent, workspace_id=None, papers=None, **kwargs):
        return {
            "stage": "summary",
            "stage_message": "Synthesizing full corpus",
            "final_text": "## Deep Research Report\nDetailed synthesis",
            "metrics": {},
            "error": None,
        }

    with (
        patch("app.api.v1.agent.retrieve_node", side_effect=mock_retrieve),
        patch("app.api.v1.agent.stream_fast_pipeline", side_effect=mock_fast_stream),
        patch("app.api.v1.agent.run_deep_pipeline_async", side_effect=mock_deep_async),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/agent/run",
                json={"query": "Find research gaps", "workspace_id": None},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            content = response.text
            assert "event: thinking" in content
            assert "event: retrieving" in content
            assert "event: token" in content
            assert "event: fast_completed" in content
            assert "event: refining" in content
            assert "event: refined_completed" in content
            assert "event: completed" in content
            assert "Fast insight." in content
            assert "## Deep Research Report" in content

    app.dependency_overrides.clear()
