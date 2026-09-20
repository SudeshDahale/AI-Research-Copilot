import pytest
from app.services.paper_service import expand_query
from app.services.ranking_service import similarity, rank_papers, tokenize


def test_expand_query_industry_terms():
    exp = expand_query("AI Assisted Tech Diagrams")
    assert len(exp) >= 2
    assert "AI Assisted Tech Diagrams" in exp
    expanded_str = " ".join(exp).lower()
    assert "diagram" in expanded_str
    assert "architecture" in expanded_str or "artificial intelligence" in expanded_str


def test_expand_query_crm_and_nlp():
    exp = expand_query("NLP for CRM systems")
    expanded_str = " ".join(exp).lower()
    assert "natural language processing" in expanded_str or "customer relationship management" in expanded_str


def test_industry_query_similarity_matching():
    query = "AI Assisted Tech Diagrams"
    paper = {
        "title": "Automated Architecture Diagram Generation with LLMs",
        "abstract": "We present an approach for generating software engineering diagrams using artificial intelligence assistance.",
        "tags": ["software", "visualization"],
        "year": 2024,
        "citations": 12,
    }
    score = similarity(query, paper)
    assert score > 0.60, f"Expected strong match score, got {score}"


def test_rank_papers_with_expanded_domain_matches():
    query = "AI Assisted Tech Diagrams"
    papers = [
        {
            "id": "p1",
            "title": "Automated Architecture Diagram Generation",
            "abstract": "Generating technical diagrams with AI.",
            "tags": ["ai"],
            "year": 2024,
            "citations": 10,
        },
        {
            "id": "p2",
            "title": "Unrelated Quantum Mechanics",
            "abstract": "Study on particles in a box.",
            "tags": ["physics"],
            "year": 2020,
            "citations": 50,
        },
    ]
    ranked = rank_papers(query, papers)
    assert ranked[0]["id"] == "p1"
    assert ranked[0]["relevance"] > ranked[1]["relevance"]
