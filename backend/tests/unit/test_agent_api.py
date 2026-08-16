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

    async def mock_astream(state):
        yield {"search": {"papers": [{"id": "p1", "title": "Test"}]}}
        yield {"ranking": {"ranked_papers": [{"id": "p1", "title": "Test"}]}}
        yield {"clustering": {"clusters": [{"theme": "AI", "paper_ids": ["p1"]}]}}
        yield {"summarize": {"corpus_summary": {"overview": "Overview"}}}
        yield {"gap_detection": {"gaps": ["Gap 1"]}}
        yield {"compose": {"final_text": "## Research gaps\nDone"}}

    with patch("app.api.v1.agent.agent_graph.astream", side_effect=mock_astream):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/agent/run",
                json={"query": "Find research gaps", "workspace_id": None},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            content = response.text
            assert "event: step" in content
            assert "event: done" in content
            assert "## Research gaps" in content

    app.dependency_overrides.clear()
