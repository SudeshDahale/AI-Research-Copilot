import pytest
from unittest.mock import AsyncMock, patch

from app.agents.graph import detect_task, compose_node, build_graph, _route_after_summarize, _route_after_gaps
from app.agents.nodes.clustering_node import _tag_fallback_clusters, clustering_node
from app.agents.nodes.search_node import search_node
from app.agents.nodes.ranking_node import ranking_node
from app.agents.nodes.summarize_node import summarize_node
from app.agents.nodes.gap_detection_node import gap_detection_node
from app.agents.nodes.lit_review_node import lit_review_node
from app.agents.prompts import gap_prompts, lit_review_prompts, summarize_prompts


def test_detect_task():
    assert detect_task("Find research gaps in this workspace") == "gaps"
    assert detect_task("What is missing in this field?") == "gaps"
    assert detect_task("Write a literature review on graph RAG") == "lit_review"
    assert detect_task("Draft related work section") == "lit_review"
    assert detect_task("Compare methodologies across these papers") == "compare"
    assert detect_task("Find contradictions and conflicts") == "contradictions"
    assert detect_task("Summarize the corpus") == "summary"
    assert detect_task("Hello agent") == "generic"


def test_routing_logic():
    assert _route_after_summarize({"task": "gaps"}) == "gap_detection"
    assert _route_after_summarize({"task": "lit_review"}) == "gap_detection"
    assert _route_after_summarize({"task": "summary"}) == "compose"
    assert _route_after_summarize({"task": "generic"}) == "compose"

    assert _route_after_gaps({"task": "lit_review"}) == "lit_review"
    assert _route_after_gaps({"task": "gaps"}) == "compose"


@pytest.mark.asyncio
async def test_compose_node_empty():
    res = await compose_node({"task": "gaps", "papers": []})
    assert "No papers in scope" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_node_gaps():
    papers = [{"id": "p1", "title": "Test Paper", "authors": ["Alice"], "year": 2024, "journal": "ArXiv"}]
    summary = {"overview": "Corpus overview text"}
    gaps = ["Gap 1: Evaluation lacking", "Gap 2: Compute costs unmeasured"]
    res = await compose_node({"task": "gaps", "papers": papers, "corpus_summary": summary, "gaps": gaps})
    assert "## Research gaps" in res["final_text"]
    assert "Corpus overview text" in res["final_text"]
    assert "Gap 1: Evaluation lacking" in res["final_text"]
    assert "Alice et al. (2024)" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_node_lit_review():
    papers = [{"id": "p1", "title": "Paper One", "authors": ["Bob"], "year": 2023, "journal": "NeurIPS"}]
    lit_review = "This is a synthesized narrative."
    res = await compose_node({"task": "lit_review", "papers": papers, "lit_review": lit_review})
    assert "## Literature review" in res["final_text"]
    assert "This is a synthesized narrative." in res["final_text"]
    assert "Bob et al. (2023)" in res["final_text"]


def test_clustering_tag_fallback():
    papers = [
        {"id": "p1", "title": "P1", "tags": ["Graph", "RAG"]},
        {"id": "p2", "title": "P2", "tags": ["Graph", "LLM"]},
        {"id": "p3", "title": "P3", "tags": ["Vision"]},
    ]
    clusters = _tag_fallback_clusters(papers)
    assert len(clusters) == 2
    graph_cluster = next(c for c in clusters if c["theme"] == "Graph")
    assert "p1" in graph_cluster["paper_ids"]
    assert "p2" in graph_cluster["paper_ids"]


@pytest.mark.asyncio
async def test_clustering_node_with_embeddings():
    # 4 papers with simple 2D dummy embeddings
    papers = [
        {"id": "p1", "title": "Paper 1", "embedding": [1.0, 0.0], "tags": ["AI"]},
        {"id": "p2", "title": "Paper 2", "embedding": [0.9, 0.1], "tags": ["AI"]},
        {"id": "p3", "title": "Paper 3", "embedding": [0.0, 1.0], "tags": ["Bio"]},
        {"id": "p4", "title": "Paper 4", "embedding": [0.1, 0.9], "tags": ["Bio"]},
    ]
    res = await clustering_node({"papers": papers})
    assert "clusters" in res
    assert len(res["clusters"]) >= 2


@pytest.mark.asyncio
async def test_summarize_node():
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "overview": "Overview of topics",
            "themes": ["Theme A", "Theme B"],
            "consensus": "Methods are effective",
        }
        res = await summarize_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert res["corpus_summary"]["overview"] == "Overview of topics"
        assert res["corpus_summary"]["themes"] == ["Theme A", "Theme B"]


@pytest.mark.asyncio
async def test_gap_detection_node():
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"gaps": ["Gap 1", "Gap 2"]}
        res = await gap_detection_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert res["gaps"] == ["Gap 1", "Gap 2"]


@pytest.mark.asyncio
async def test_lit_review_node():
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"narrative": "Comprehensive narrative."}
        res = await lit_review_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert res["lit_review"] == "Comprehensive narrative."


@pytest.mark.asyncio
async def test_full_agent_graph_execution():
    graph = build_graph()
    mock_papers = [
        {"id": "p1", "title": "Paper A", "abstract": "About AI", "tags": ["AI"], "year": 2024, "journal": "Nature", "authors": ["Smith"]},
        {"id": "p2", "title": "Paper B", "abstract": "About ML", "tags": ["ML"], "year": 2023, "journal": "Science", "authors": ["Doe"]},
    ]

    with patch("app.services.paper_service.search_papers", new_callable=AsyncMock) as mock_search, \
         patch("app.services.vector_service.embed_text", new_callable=AsyncMock) as mock_embed, \
         patch("app.services.ranking_service.rank_papers") as mock_rank, \
         patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        
        mock_search.return_value = mock_papers
        mock_embed.return_value = [0.1, 0.2]
        mock_rank.return_value = mock_papers
        mock_llm.side_effect = [
            {"overview": "Summary overview", "themes": ["AI", "ML"], "consensus": "Consistent results"},
            {"gaps": ["Gap in scaling", "Gap in evaluation"]},
        ]

        state = {
            "query": "Find research gaps in AI",
            "task": "gaps",
            "workspace_id": None,
        }
        result = await graph.ainvoke(state)
        assert "final_text" in result
        assert "## Research gaps" in result["final_text"]
        assert "Gap in scaling" in result["final_text"]
