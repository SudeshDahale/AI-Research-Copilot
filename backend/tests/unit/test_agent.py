"""Agent unit tests — Sprint 8.

Updated to match the new Sprint 8 architecture:
  - router.detect_intent_rules() replaces old detect_task()
  - New graph: retrieve → [intent node] → compose
  - State uses "intent" (not "task"), "result" (not corpus_summary/gaps/lit_review)
  - compose_node reads from state["result"]
  - workspace isolation: empty workspace returns error, no external fallback
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.router import detect_intent_rules
from app.agents.graph import build_graph, _route_after_retrieve
from app.agents.nodes.compose import compose_node
from app.agents.nodes.summary import summary_node
from app.agents.nodes.gaps import gaps_node
from app.agents.nodes.compare import compare_node
from app.agents.nodes.contradiction import contradiction_node
from app.agents.cache import get_corpus_cache, set_corpus_cache, invalidate_workspace


# ---------------------------------------------------------------------------
# 1. Intent router (rule-based)
# ---------------------------------------------------------------------------

def test_detect_intent_rules_gaps():
    assert detect_intent_rules("Find research gaps in this workspace") == "gaps"
    assert detect_intent_rules("What is missing in this field?") == "gaps"
    assert detect_intent_rules("future work in graph neural nets") == "gaps"
    assert detect_intent_rules("unaddressed limitations of transformers") == "gaps"


def test_detect_intent_rules_lit_review():
    assert detect_intent_rules("Write a literature review on graph RAG") == "literature_review"
    assert detect_intent_rules("Draft related work section") == "literature_review"
    assert detect_intent_rules("give me a synthesis of the corpus") == "literature_review"


def test_detect_intent_rules_compare():
    assert detect_intent_rules("Compare methodologies across these papers") == "compare"
    assert detect_intent_rules("contrast these two approaches") == "compare"


def test_detect_intent_rules_contradictions():
    assert detect_intent_rules("Find contradictions and conflicts") == "contradictions"
    assert detect_intent_rules("which papers disagree with each other?") == "contradictions"
    assert detect_intent_rules("inconsistent findings in NLP") == "contradictions"


def test_detect_intent_rules_summary():
    assert detect_intent_rules("Summarize the corpus") == "summary"
    assert detect_intent_rules("give me an overview") == "summary"


def test_detect_intent_rules_ambiguous():
    # Ambiguous queries should return None (falls back to LLM classifier)
    assert detect_intent_rules("Hello agent") is None
    assert detect_intent_rules("Understand these papers") is None


def test_detect_intent_rules_no_false_gaps():
    # "understand" should NOT trigger gaps via fragile substring match
    result = detect_intent_rules("understand these papers")
    assert result != "gaps", "Fragile substring match triggered 'gaps' for 'understand'"


# ---------------------------------------------------------------------------
# 2. Graph routing
# ---------------------------------------------------------------------------

def test_route_after_retrieve_empty_workspace():
    state = {"error": "empty_workspace", "papers": []}
    assert _route_after_retrieve(state) == "compose"


def test_route_after_retrieve_db_error():
    state = {"error": "Could not load workspace papers: connection refused", "papers": []}
    assert _route_after_retrieve(state) == "compose"


def test_route_after_retrieve_intents():
    assert _route_after_retrieve({"intent": "summary", "papers": [{}]}) == "summary"
    assert _route_after_retrieve({"intent": "gaps", "papers": [{}]}) == "gaps"
    assert _route_after_retrieve({"intent": "compare", "papers": [{}]}) == "compare"
    assert _route_after_retrieve({"intent": "contradictions", "papers": [{}]}) == "contradictions"
    assert _route_after_retrieve({"intent": "literature_review", "papers": [{}]}) == "review"
    assert _route_after_retrieve({"intent": "generic", "papers": [{}]}) == "summary"


# ---------------------------------------------------------------------------
# 3. Compose node — intent-aware output
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compose_empty_workspace_error():
    res = await compose_node({"error": "empty_workspace", "papers": []})
    assert "Empty workspace" in res["final_text"]
    assert "no papers" in res["final_text"].lower()


@pytest.mark.asyncio
async def test_compose_no_papers():
    res = await compose_node({"intent": "gaps", "papers": [], "result": {}})
    assert "No papers" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_summary_intent():
    papers = [{"id": "p1", "title": "Test Paper", "authors": ["Alice"], "year": 2024, "journal": "ArXiv"}]
    result = {"overview": "Corpus overview text", "themes": ["AI", "ML"], "key_findings": ["Finding A"]}
    res = await compose_node({"intent": "summary", "papers": papers, "result": result})
    assert "## Research Summary" in res["final_text"]
    assert "Corpus overview text" in res["final_text"]
    assert "Finding A" in res["final_text"]
    assert "Alice et al. (2024)" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_gaps_intent():
    papers = [{"id": "p1", "title": "Test Paper", "authors": ["Alice"], "year": 2024, "journal": "ArXiv"}]
    result = {
        "gaps": [
            {"title": "Evaluation gap", "description": "No benchmark coverage.", "supporting_papers": ["p1"]}
        ]
    }
    res = await compose_node({"intent": "gaps", "papers": papers, "result": result})
    assert "## Research Gaps" in res["final_text"]
    assert "Evaluation gap" in res["final_text"]
    assert "No benchmark coverage." in res["final_text"]


@pytest.mark.asyncio
async def test_compose_compare_intent_table():
    papers = [
        {"id": "p1", "title": "Paper A", "authors": ["Alice"], "year": 2024, "journal": "ICML"},
        {"id": "p2", "title": "Paper B", "authors": ["Bob"], "year": 2023, "journal": "NeurIPS"},
    ]
    result = {
        "comparisons": [
            {
                "method": "Transformer",
                "papers": ["Paper A"],
                "strengths": ["Scalable"],
                "weaknesses": ["Slow"],
                "differences": ["Attention-based vs convolution"],
            }
        ]
    }
    res = await compose_node({"intent": "compare", "papers": papers, "result": result})
    assert "## Methodology Comparison" in res["final_text"]
    assert "Transformer" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_contradictions_none_found():
    papers = [{"id": "p1", "title": "P1", "authors": ["A"], "year": 2024, "journal": "J"}]
    res = await compose_node({"intent": "contradictions", "papers": papers, "result": {"contradictions": []}})
    assert "No genuine contradictions" in res["final_text"]


@pytest.mark.asyncio
async def test_compose_lit_review_intent():
    papers = [{"id": "p1", "title": "Paper One", "authors": ["Bob"], "year": 2023, "journal": "NeurIPS"}]
    result = {
        "introduction": "This review covers...",
        "themes": [{"label": "NLP", "summary": "NLP advances."}],
        "discussion": "Overall progress is strong.",
        "research_gaps": ["Scaling remains unsolved"],
        "conclusion": "Future work is needed.",
    }
    res = await compose_node({"intent": "literature_review", "papers": papers, "result": result})
    assert "## Literature Review" in res["final_text"]
    assert "This review covers..." in res["final_text"]
    assert "Bob et al. (2023)" in res["final_text"]


# ---------------------------------------------------------------------------
# 4. Analysis nodes — unit tests with mocked LLM
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_node():
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "overview": "Overview of topics",
            "themes": ["Theme A", "Theme B"],
            "key_findings": ["Finding 1"],
        }
        res = await summary_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert res["result"]["overview"] == "Overview of topics"
        assert res["result"]["themes"] == ["Theme A", "Theme B"]


@pytest.mark.asyncio
async def test_summary_node_empty():
    res = await summary_node({"papers": []})
    assert res["result"]["overview"] == "No papers in scope."


@pytest.mark.asyncio
async def test_gaps_node():
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "gaps": [
                {"title": "Gap 1", "description": "Missing eval", "supporting_papers": ["p1"]}
            ]
        }
        res = await gaps_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert len(res["result"]["gaps"]) == 1
        assert res["result"]["gaps"][0]["title"] == "Gap 1"


@pytest.mark.asyncio
async def test_gaps_node_normalizes_string_gaps():
    """Old format (list of strings) should be normalized to dicts."""
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"gaps": ["Gap string 1", "Gap string 2"]}
        res = await gaps_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
        assert all(isinstance(g, dict) for g in res["result"]["gaps"])


@pytest.mark.asyncio
async def test_gaps_node_no_summarize_dependency():
    """gaps_node must NOT require corpus_summary in state."""
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"gaps": [{"title": "G1", "description": "d", "supporting_papers": []}]}
        # No corpus_summary key in state at all
        state = {"papers": [{"id": "p1", "title": "T", "abstract": "A"}]}
        res = await gaps_node(state)
        assert "gaps" in res["result"]


@pytest.mark.asyncio
async def test_compare_node_needs_two_papers():
    res = await compare_node({"papers": [{"id": "p1", "title": "T", "abstract": "A"}]})
    assert "_note" in res["result"]


@pytest.mark.asyncio
async def test_compare_node():
    papers = [
        {"id": "p1", "title": "T1", "abstract": "A1"},
        {"id": "p2", "title": "T2", "abstract": "A2"},
    ]
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "comparisons": [{"method": "CNN", "papers": ["T1"], "strengths": ["Fast"], "weaknesses": [], "differences": []}]
        }
        res = await compare_node({"papers": papers})
        assert res["result"]["comparisons"][0]["method"] == "CNN"


@pytest.mark.asyncio
async def test_contradiction_node_no_contradictions():
    papers = [
        {"id": "p1", "title": "T1", "abstract": "A1"},
        {"id": "p2", "title": "T2", "abstract": "A2"},
    ]
    with patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"contradictions": []}
        res = await contradiction_node({"papers": papers})
        assert res["result"]["contradictions"] == []


# ---------------------------------------------------------------------------
# 5. Corpus cache
# ---------------------------------------------------------------------------

def test_corpus_cache_set_get():
    set_corpus_cache("ws-test-1", 5, {"clusters": ["A", "B"]})
    cached = get_corpus_cache("ws-test-1", 5)
    assert cached is not None
    assert cached["clusters"] == ["A", "B"]


def test_corpus_cache_miss_wrong_count():
    set_corpus_cache("ws-test-2", 10, {"clusters": ["X"]})
    # Different paper count → cache miss
    assert get_corpus_cache("ws-test-2", 9) is None
    assert get_corpus_cache("ws-test-2", 11) is None


def test_corpus_cache_invalidate():
    set_corpus_cache("ws-inv-1", 3, {"data": "x"})
    set_corpus_cache("ws-inv-1", 5, {"data": "y"})
    evicted = invalidate_workspace("ws-inv-1")
    assert evicted == 2
    assert get_corpus_cache("ws-inv-1", 3) is None
    assert get_corpus_cache("ws-inv-1", 5) is None


# ---------------------------------------------------------------------------
# 6. Full graph integration (no real DB / LLM)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_graph_gaps_intent():
    graph = build_graph()
    mock_papers = [
        {"id": "p1", "title": "Paper A", "abstract": "About AI", "tags": ["AI"],
         "year": 2024, "journal": "Nature", "authors": ["Smith"], "citations": 10},
        {"id": "p2", "title": "Paper B", "abstract": "About ML", "tags": ["ML"],
         "year": 2023, "journal": "Science", "authors": ["Doe"], "citations": 5},
    ]

    with patch("app.services.paper_service.search_papers", new_callable=AsyncMock) as mock_search, \
         patch("app.services.llm_service.generate_structured_json", new_callable=AsyncMock) as mock_llm:

        mock_search.return_value = mock_papers
        mock_llm.return_value = {
            "gaps": [
                {"title": "Gap in scaling", "description": "No scaling study found.", "supporting_papers": ["p1"]}
            ]
        }

        state = {
            "query": "Find research gaps in AI",
            "intent": "gaps",
            "workspace_id": None,
        }
        result = await graph.ainvoke(state)
        assert "final_text" in result
        assert "## Research Gaps" in result["final_text"]
        assert "Gap in scaling" in result["final_text"]
        # Verify: only ONE LLM call (no summarize → gap chain)
        assert mock_llm.call_count == 1, f"Expected 1 LLM call, got {mock_llm.call_count}"


@pytest.mark.asyncio
async def test_full_graph_empty_workspace():
    """Empty workspace must NOT trigger external search."""
    graph = build_graph()

    with patch("app.db.session.AsyncSessionLocal") as mock_session_cls, \
         patch("app.services.paper_service.search_papers", new_callable=AsyncMock) as mock_search:

        # DB returns empty list (no papers in workspace)
        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
        mock_cm.__aexit__ = AsyncMock(return_value=False)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_cm.execute = AsyncMock(return_value=mock_result)
        mock_session_cls.return_value = mock_cm

        state = {
            "query": "Find research gaps",
            "intent": "gaps",
            "workspace_id": "00000000-0000-0000-0000-000000000001",
        }
        result = await graph.ainvoke(state)

        # External search must never be called
        mock_search.assert_not_called()
        # Error message surfaced to user
        assert "final_text" in result
        assert "empty" in result["final_text"].lower() or "no papers" in result["final_text"].lower()
