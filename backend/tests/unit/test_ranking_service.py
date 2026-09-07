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
    assert score >= 0.88


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
    assert score >= 0.90


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

