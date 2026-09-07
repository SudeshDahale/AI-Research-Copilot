from datetime import datetime
import math
import re

STOP_WORDS = {
    "the", "a", "an", "of", "in", "on", "for", "and", "or", "to", "with", "using", "via", "how", "what",
    "why", "when", "where", "who", "which", "is", "are", "be", "been", "being", "by", "at", "from", "about",
    "research", "paper", "papers", "study", "studies", "find", "finding", "show", "showing", "give", "me",
    "list", "get", "do", "does", "did", "can", "could", "will", "would", "shall", "should", "into", "than",
    "that", "this", "these", "those", "their", "its", "has", "have", "had", "as", "such", "some", "any"
}

def tokenize(s: str | None) -> list[str]:
    """Tokenize text by lowering, splitting on non-alphanumeric, and filtering stop words.
    Keeps 2-letter tokens (e.g. 'ai', 'ml', 'rl', 'cv', 'dl', 'kg', 'ir') while discarding 1-char noise.
    """
    if not s:
        return []
    tokens = re.split(r"[^a-z0-9]+", s.lower())
    return [t for t in tokens if len(t) >= 2 and t not in STOP_WORDS]

def semantic_similarity(
    query_embedding: list[float] | None, paper_embedding: list[float] | None
) -> float:
    """Cosine similarity between query and paper vectors, rescaled to [0, 1].
    Returns 0.0 whenever either vector is missing.
    """
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

    Focuses on core keywords, rewarding title matches and domain tags heavily
    while scaling strong conceptual matches to natural 85%-98% percentages.
    """
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0

    title_tokens = tokenize(paper.get("title", ""))
    abstract_tokens = tokenize(paper.get("abstract", ""))
    tags = [t.lower() for t in (paper.get("tags") or [])]

    q_unique = list(set(q_tokens))
    total_q = len(q_unique)

    title_matches = 0
    tag_matches = 0
    abstract_matches = 0
    any_matches = 0

    for term in q_unique:
        matched = False
        in_title = any(term == w or term in w or w in term for w in title_tokens)
        in_tags = any(term in t or t in term for t in tags)
        in_abstract = any(term == w for w in abstract_tokens)

        if in_title:
            title_matches += 1
            matched = True
        if in_tags:
            tag_matches += 1
            matched = True
        if in_abstract:
            abstract_matches += 1
            matched = True

        if matched:
            any_matches += 1

    # If no core terms match anywhere in title, abstract, or tags
    if any_matches == 0:
        return 0.0

    title_cov = title_matches / total_q
    tag_cov = tag_matches / total_q
    abstract_cov = abstract_matches / total_q
    overall_cov = any_matches / total_q

    # Base lexical score combining title, overall concept coverage, and abstract context
    base_score = (0.40 * title_cov) + (0.35 * overall_cov) + (0.15 * abstract_cov) + (0.10 * tag_cov)

    # Title dominance provides a strong baseline floor when query terms are in the title
    if title_cov >= 0.5:
        title_floor = 0.70 + (0.20 * title_cov)
        base_score = max(base_score, title_floor + (0.10 * tag_cov) + (0.10 * abstract_cov))

    if title_cov == 1.0 and (abstract_cov > 0 or tag_cov > 0):
        base_score = max(base_score, 0.98)
    elif title_cov == 1.0:
        base_score = max(base_score, 0.95)

    raw_lexical = min(1.0, base_score)
    lexical = raw_lexical ** 0.65

    current_year = datetime.now().year
    year = paper.get("year", current_year)
    recency = min(1.0, max(0.0, (year - 2018) / 8.0))

    # Recency grace period (< 18 months): drop citation penalty
    is_recent_paper = False
    published_raw = paper.get("published") or paper.get("published_date")
    if isinstance(published_raw, str) and len(published_raw) >= 7:
        try:
            pub_dt = datetime.fromisoformat(published_raw.replace("Z", "+00:00").split("T")[0])
            months_diff = (datetime.now().year - pub_dt.year) * 12 + (datetime.now().month - pub_dt.month)
            is_recent_paper = months_diff < 18
        except Exception:
            is_recent_paper = (current_year - year) <= 1
    else:
        is_recent_paper = (current_year - year) <= 1

    citations = paper.get("citations", 0)
    impact = min(1.0, math.log10(citations + 1) / 3.5)

    semantic = semantic_similarity(query_embedding, paper.get("embedding"))
    if semantic > 0:
        if is_recent_paper:
            return min(0.99, lexical * 0.55 + semantic * 0.30 + recency * 0.15)
        return min(0.99, lexical * 0.45 + semantic * 0.30 + recency * 0.10 + impact * 0.15)

    if is_recent_paper:
        return min(0.99, lexical * 0.85 + recency * 0.15)
    return min(0.99, lexical * 0.75 + recency * 0.10 + impact * 0.15)

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