from datetime import datetime
from app.services.ranking_service import similarity, rank_papers, tokenize


def test_tokenize_filters_stop_words_and_keeps_acronyms():
    tokens = tokenize("What is the impact of AI and ML on reasoning?")
    assert "ai" in tokens
    assert "ml" in tokens
    assert "reasoning" in tokens
    assert "impact" in tokens
    assert "what" not in tokens
    assert "the" not in tokens
    assert "is" not in tokens


def test_the_ai_query():
    query = "the ai"
    paper = {
        "title": "Reasoning Capabilities of AI Models",
        "abstract": "We explore artificial intelligence architectures.",
        "tags": ["ai"],
        "year": datetime.now().year,
        "citations": 0,
    }
    score = similarity(query, paper)
    # 'ai' in title and tags -> strong match
    assert score >= 0.80


def test_lexical_title_and_abstract_full_match():
    query = "transformer reasoning"
    paper = {
        "title": "Transformer Reasoning Architecture",
        "abstract": "We explore reasoning in transformer models.",
        "tags": [],
        "year": datetime.now().year,
        "citations": 0,
    }
    score = similarity(query, paper)
    assert score >= 0.85


def test_tags_act_as_bonus():
    query = "diffusion synthesis"
    paper_without_tags = {
        "title": "Diffusion Models",
        "abstract": "A study on images.",
        "tags": [],
        "year": 2020,
        "citations": 100,
    }
    paper_with_tags = {
        "title": "Diffusion Models",
        "abstract": "A study on images.",
        "tags": ["synthesis"],
        "year": 2020,
        "citations": 100,
    }
    score_without = similarity(query, paper_without_tags)
    score_with = similarity(query, paper_with_tags)
    assert score_with > score_without


def test_recent_paper_grace_period_redistributes_citation_weight():
    current_year = datetime.now().year
    recent_zero_cites = {
        "title": "Attention Mechanisms for Language",
        "abstract": "We propose new attention mechanisms for language understanding.",
        "tags": ["nlp"],
        "year": current_year,
        "citations": 0,
    }
    old_zero_cites = {
        "title": "Attention Mechanisms for Language",
        "abstract": "We propose new attention mechanisms for language understanding.",
        "tags": ["nlp"],
        "year": 2019,
        "citations": 0,
    }
    score_recent = similarity("attention language", recent_zero_cites)
    score_old = similarity("attention language", old_zero_cites)

    # Recent zero-citation paper should score higher because citation penalty is dropped
    assert score_recent > score_old


def test_ai_assisted_tech_diagram_scenario():
    """Specific test verifying high-specificity query matching vs. irrelevant author/generic papers."""
    query = "ai assisted tech diagram"

    # Highly relevant paper
    relevant_paper = {
        "title": "AI-Assisted Generation of Technical Architecture Diagrams and UML Schematics",
        "abstract": "We present an automated LLM-assisted tool for synthesizing software engineering diagrams from code.",
        "tags": ["software engineering", "diagrams"],
        "authors": ["John Doe", "Jane Smith"],
        "year": datetime.now().year,
        "citations": 5,
    }

    # Irrelevant paper where "Ai" is just author surname and contains generic "system" words
    irrelevant_quantum_paper = {
        "title": "Quantum batteries in coherent Ising machine",
        "abstract": "With intensive studies of quantum thermodynamics, quantum batteries have been proposed to store energy.",
        "tags": ["quant-ph"],
        "authors": ["Qing Ai", "Tao Liu"],
        "year": datetime.now().year,
        "citations": 0,
    }

    # Irrelevant paper with generic AI communication
    irrelevant_wireless_paper = {
        "title": "White-Box AI Model: Next Frontier of Wireless Communications",
        "abstract": "White-box AI model achieves reasoning behind decisions in wireless communication systems.",
        "tags": ["cs.IT"],
        "authors": ["Bo Ai", "Jiayi Zhang"],
        "year": datetime.now().year,
        "citations": 0,
    }

    score_rel = similarity(query, relevant_paper)
    score_quantum = similarity(query, irrelevant_quantum_paper)
    score_wireless = similarity(query, irrelevant_wireless_paper)

    assert score_rel >= 0.85
    assert score_quantum == 0.0  # Zero because discriminative 'diagram' is completely missing
    assert score_wireless == 0.0  # Zero because discriminative 'diagram' is completely missing

    # Test rank_papers
    results = rank_papers(query, [irrelevant_quantum_paper, relevant_paper, irrelevant_wireless_paper])
    assert len(results) == 3
    assert results[0]["title"] == relevant_paper["title"]
    assert results[0]["relevance"] == score_rel
