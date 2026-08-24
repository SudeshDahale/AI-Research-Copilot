import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.agents.discover_router import detect_discover_intent
from app.services import discover_filter_service


def test_detect_discover_intent_top_n():
    intent, extra = detect_discover_intent("show me top 5 papers")
    assert intent == "top_n"
    assert extra.get("n") == 5

    intent, extra = detect_discover_intent("3 most relevant")
    assert intent == "top_n"
    assert extra.get("n") == 3


def test_detect_discover_intent_add_workspace():
    intent, _ = detect_discover_intent("add to workspace")
    assert intent == "add_to_workspace"

    intent, _ = detect_discover_intent("save these papers")
    assert intent == "add_to_workspace"


def test_detect_discover_intent_search():
    intent, _ = detect_discover_intent("search transformer architectures")
    assert intent == "search"

    intent, _ = detect_discover_intent("find papers on diffusion")
    assert intent == "search"


def test_detect_discover_intent_fallback_filter():
    intent, _ = detect_discover_intent("papers published after 2023 with retrieval")
    assert intent == "filter"


def test_discover_filter_top_n():
    candidates = [{"id": f"p{i}", "title": f"Paper {i}"} for i in range(10)]
    result = discover_filter_service.top_n(candidates, 3)
    assert len(result) == 3
    assert result[0]["id"] == "p0"
    assert result[2]["id"] == "p2"


def test_discover_apply_filter():
    candidates = [
        {"id": "p1", "title": "Retrieval Augmented Generation", "abstract": "LLM grounding", "year": 2024, "tags": ["RAG"]},
        {"id": "p2", "title": "Old Paper on CNNs", "abstract": "Vision", "year": 2018, "tags": ["Vision"]},
        {"id": "p3", "title": "Agentic Reasoning in 2023", "abstract": "Multi-agent systems", "year": 2023, "tags": ["Agents"]},
    ]

    # Year filter
    filt_year = {"min_year": 2023, "max_year": 2024}
    res = discover_filter_service.apply_filter(candidates, filt_year)
    assert len(res) == 2
    assert {p["id"] for p in res} == {"p1", "p3"}

    # Keyword filter
    filt_kw = {"keywords": ["retrieval"]}
    res = discover_filter_service.apply_filter(candidates, filt_kw)
    assert len(res) == 1
    assert res[0]["id"] == "p1"

    # Limit
    filt_limit = {"limit": 1}
    res = discover_filter_service.apply_filter(candidates, filt_limit)
    assert len(res) == 1


@pytest.mark.asyncio
async def test_discover_chat_endpoint_top_n():
    candidates = [
        {"id": "p1", "title": "Paper 1", "year": 2024},
        {"id": "p2", "title": "Paper 2", "year": 2023},
    ]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/discover/chat",
            json={
                "message": "top 1",
                "query": "test query",
                "candidates": candidates,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "top_n"
        assert len(data["papers"]) == 1
        assert data["papers"][0]["id"] == "p1"


@pytest.mark.asyncio
async def test_discover_chat_endpoint_filter():
    candidates = [
        {"id": "p1", "title": "Paper 1", "year": 2024, "abstract": "LLM study"},
        {"id": "p2", "title": "Paper 2", "year": 2019, "abstract": "Old study"},
    ]
    mock_extracted = {"min_year": 2023}
    with patch("app.services.discover_filter_service.extract_filter", AsyncMock(return_value=mock_extracted)):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/discover/chat",
                json={
                    "message": "only papers from 2023 onwards",
                    "query": "test",
                    "candidates": candidates,
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["action"] == "filter"
            assert len(data["papers"]) == 1
            assert data["papers"][0]["id"] == "p1"
