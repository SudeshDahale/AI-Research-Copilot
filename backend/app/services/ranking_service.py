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

def semantic_similarity(
    query_embedding: list[float] | None, paper_embedding: list[float] | None
) -> float:
    """Cosine similarity between query and paper vectors, rescaled to [0, 1].
    Returns 0.0 whenever either vector is missing — e.g. no VOYAGE_API_KEY
    configured, or this particular paper hasn't been embedded yet — so the
    caller can fall back to a lexical-only blend instead of crashing."""
    if not query_embedding or not paper_embedding:
        return 0.0
    dot = sum(a * b for a, b in zip(query_embedding, paper_embedding))
    norm_q = math.sqrt(sum(a * a for a in query_embedding))
    norm_p = math.sqrt(sum(b * b for b in paper_embedding))
    if norm_q == 0 or norm_p == 0:
        return 0.0
    cosine = dot / (norm_q * norm_p)
    return (cosine + 1) / 2  # [-1, 1] -> [0, 1]

def similarity(query: str, paper: dict, query_embedding: list[float] | None = None) -> float:
    """Calculate the relevance score for a paper against a query.

    When a semantic vector is available for this paper (query_embedding is
    set AND paper has an "embedding" key), semantic similarity gets a real
    weight in the blend. Otherwise this collapses back to the original
    Sprint 3 lexical/recency/impact formula — most search results are
    ephemeral and never embedded, so this fallback is the common case.
    """
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0

    title_tokens = tokenize(paper.get("title", ""))
    abstract_tokens = tokenize(paper.get("abstract", ""))
    tags = [t.lower() for t in (paper.get("tags") or [])]

    score = 0.0
    q_unique = set(q_tokens)
    for term in q_unique:
        if any(term in t or t in term for t in tags):
            score += 3.0
        if any(term in w or w in term for w in title_tokens):
            score += 2.5
        if any(w == term for w in abstract_tokens):
            score += 1.0

    max_score = len(q_unique) * 6.5
    lexical = min(1.0, score / max_score) if max_score > 0 else 0.0

    year = paper.get("year", 2024)
    recency = min(1.0, max(0.0, (year - 2018) / 8.0))

    citations = paper.get("citations", 0)
    impact = min(1.0, math.log10(citations + 1) / 3.5)

    semantic = semantic_similarity(query_embedding, paper.get("embedding"))
    if semantic > 0:
        return min(0.99, lexical * 0.45 + semantic * 0.30 + recency * 0.10 + impact * 0.15)
    return min(0.99, lexical * 0.72 + recency * 0.13 + impact * 0.15)

def rank_papers(
    query: str, papers: list[dict], query_embedding: list[float] | None = None
) -> list[dict]:
    """Assign relevance score and sort papers descending."""
    ranked = []
    for p in papers:
        p_copy = dict(p)
        p_copy["relevance"] = similarity(query, p_copy, query_embedding)
        ranked.append(p_copy)
    ranked.sort(key=lambda x: x["relevance"], reverse=True)
    return ranked