import re
import math

STOP_WORDS = {
    "the", "a", "an", "of", "in", "on", "for", "and", "or", "to", "with", "using", "via", "how", "what",
    "is", "are", "be", "by", "at", "from", "about", "research", "paper", "papers", "study", "studies"
}

def tokenize(s: str | None) -> list[str]:
    """Tokenize text by lowering, splitting on non-alphanumeric, and filtering stop words."""
    if not s:
        return []
    tokens = re.split(r"[^a-z0-9]+", s.lower())
    return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]

def similarity(query: str, paper: dict) -> float:
    """Calculate the similarity score between a query and a paper dict."""
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0

    title_tokens = tokenize(paper.get("title", ""))
    abstract_tokens = tokenize(paper.get("abstract", ""))
    tags = [t.lower() for t in (paper.get("tags") or [])]

    score = 0.0
    q_unique = set(q_tokens)
    for term in q_unique:
        # tag match = +3
        if any(term in t or t in term for t in tags):
            score += 3.0
        # title match = +2.5
        if any(term in w or w in term for w in title_tokens):
            score += 2.5
        # abstract match = +1
        if any(w == term for w in abstract_tokens):
            score += 1.0

    max_score = len(q_unique) * 6.5
    lexical = min(1.0, score / max_score) if max_score > 0 else 0.0

    # recency relative to 2018
    year = paper.get("year", 2024)
    recency = min(1.0, max(0.0, (year - 2018) / 8.0))

    # impact (citations)
    citations = paper.get("citations", 0)
    impact = min(1.0, math.log10(citations + 1) / 3.5)

    # blend formula
    return min(0.99, lexical * 0.72 + recency * 0.13 + impact * 0.15)

def rank_papers(query: str, papers: list[dict]) -> list[dict]:
    """Assign relevance score and sort papers descending."""
    ranked = []
    for p in papers:
        p_copy = dict(p)
        p_copy["relevance"] = similarity(query, p_copy)
        ranked.append(p_copy)
    ranked.sort(key=lambda x: x["relevance"], reverse=True)
    return ranked
