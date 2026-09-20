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

# Domain acronyms that must never be removed
DOMAIN_TERMS = {
    # Core AI/ML
    "ai", "ml", "dl", "rl", "cv", "nlp", "nlu", "nlg",
    # Model architectures & techniques
    "llm", "llms", "gpt", "gnn", "rnn", "cnn", "lstm", "bert", "vit",
    "rag", "lora", "peft", "rlhf", "dpo", "sft", "moe",
    "gan", "vae", "vqvae",
    # Systems / infra
    "api", "sdk", "ui", "ux", "os", "db",
    "mlops", "devops", "cicd",
    # Applied domains
    "iot", "ar", "vr", "xr", "ocr", "asr", "tts",
    # IR / knowledge
    "ir", "kg", "qa", "kv", "kb",
    # Engineering / modeling
    "uml", "sql", "dag",
}

# Strict, academic-grade synonyms to prevent irrelevant cross-topic matches
SYNONYM_MAP: dict[str, set[str]] = {
    "ai": {"artificial intelligence", "ai"},
    "ml": {"machine learning", "ml"},
    "nlp": {"natural language processing", "nlp", "computational linguistics"},
    "cv": {"computer vision", "cv"},
    "rl": {"reinforcement learning", "rl"},
    "llm": {"large language model", "large language models", "llm", "llms", "generative ai"},
    "llms": {"large language model", "large language models", "llm", "llms", "generative ai"},
    "rag": {"retrieval augmented generation", "rag"},
    "kg": {"knowledge graph", "knowledge graphs"},
    "tech": {"technical", "technology"},
    "technical": {"tech", "technology"},
    "diagram": {"diagram", "diagrams", "diagramming", "flowchart", "flowcharts", "uml", "schematic", "schematics", "visual diagram", "architecture diagram"},
    "diagrams": {"diagram", "diagrams", "diagramming", "flowchart", "flowcharts", "uml", "schematic", "schematics", "visual diagram", "architecture diagram"},
    "assisted": {"assist", "assisted", "assisting", "assistant", "assistance", "automated", "automatic", "generation", "generating", "guided"},
    "crm": {"customer relationship management", "crm"},
    "cicd": {"continuous integration", "continuous delivery", "cicd"},
    "devops": {"devops", "developer operations"},
    "mlops": {"mlops", "machine learning operations"},
}

# Broad/generic words that carry lower discrimination compared to specific domain concepts
COMMON_BROAD_WORDS = {
    "ai", "ml", "tech", "technology", "system", "systems", "model", "models",
    "method", "methods", "approach", "approaches", "framework", "frameworks",
    "analysis", "application", "applications", "data", "learning", "deep"
}


def tokenize(s: str | None) -> list[str]:
    """Tokenize text by lowering, splitting on non-alphanumeric, and filtering stop words."""
    if not s:
        return []
    tokens = re.split(r"[^a-z0-9]+", s.lower())
    return [t for t in tokens if len(t) >= 2 and (t in DOMAIN_TERMS or t not in STOP_WORDS)]


def stem_token(token: str) -> str:
    """Lightweight suffix stripping for plural and verb forms."""
    t = token.lower()
    for suffix in ("ing", "tion", "tions", "ies", "es", "ed", "s"):
        if len(t) > len(suffix) + 2 and t.endswith(suffix):
            if suffix == "ies":
                return t[:-3] + "y"
            return t[:-len(suffix)]
    return t


def get_term_weight(term: str) -> float:
    """Assign higher discrimination weight to rare/specific terms (IDF approximation)."""
    t = term.lower()
    if t in COMMON_BROAD_WORDS:
        return 1.0
    # Specific terms (e.g. 'diagram', 'uml', 'flowchart', 'benchmark', 'quantum', 'battery')
    return 2.5


def semantic_similarity(
    query_embedding: list[float] | None, paper_embedding: list[float] | None
) -> float:
    """Cosine similarity between query and paper vectors, rescaled to [0, 1]."""
    if not query_embedding or not paper_embedding:
        return 0.0
    dot = sum(a * b for a, b in zip(query_embedding, paper_embedding))
    norm_q = math.sqrt(sum(a * a for a in query_embedding))
    norm_p = math.sqrt(sum(b * b for b in paper_embedding))
    if norm_q == 0 or norm_p == 0:
        return 0.0
    cosine = dot / (norm_q * norm_p)
    return (cosine + 1) / 2  # [-1, 1] -> [0, 1]


def _match_term(term: str, target_tokens: list[str], target_text: str) -> bool:
    """Check if term matches directly, via stem, or via domain synonyms."""
    if not term:
        return False

    stemmed_term = stem_token(term)
    synonyms = SYNONYM_MAP.get(term, set())

    for w in target_tokens:
        if term == w:
            return True
        stemmed_w = stem_token(w)
        if stemmed_term == stemmed_w:
            return True
        if stemmed_w in synonyms or w in synonyms:
            return True

    # Multi-word phrase check (e.g. 'artificial intelligence' for 'ai' or 'visual diagram' for 'diagram')
    for syn in synonyms:
        if " " in syn and syn in target_text:
            return True

    return False


def _check_phrase_cooccurrence(query_tokens: list[str], target_text: str) -> float:
    """Check for consecutive bi-gram or tri-gram phrase matches in target text."""
    if len(query_tokens) < 2 or not target_text:
        return 0.0

    bonus = 0.0
    # Check bi-grams
    for i in range(len(query_tokens) - 1):
        bigram = f"{query_tokens[i]} {query_tokens[i+1]}"
        if bigram in target_text:
            bonus += 0.12

    # Check tri-grams
    for i in range(len(query_tokens) - 2):
        trigram = f"{query_tokens[i]} {query_tokens[i+1]} {query_tokens[i+2]}"
        if trigram in target_text:
            bonus += 0.18

    return min(0.25, bonus)


def similarity(query: str, paper: dict, query_embedding: list[float] | None = None) -> float:
    """Calculate academic relevance score for a paper against a user query.

    Uses:
    1. Term specificity weighting (high weight for discriminative domain terms like 'diagram')
    2. Academic title & abstract matching with strict synonym control
    3. Phrase co-occurrence boost
    4. Honest, un-inflated scoring calibration
    """
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0

    title_raw = paper.get("title", "") or ""
    abstract_raw = paper.get("abstract", "") or ""
    title_text = title_raw.lower()
    abstract_text = abstract_raw.lower()

    title_tokens = tokenize(title_text)
    abstract_tokens = tokenize(abstract_text)
    tags = [t.lower() for t in (paper.get("tags") or [])]

    q_unique = list(dict.fromkeys(q_tokens))  # preserve order & deduplicate
    total_weighted_query = sum(get_term_weight(t) for t in q_unique)

    title_weighted_matches = 0.0
    abstract_weighted_matches = 0.0
    tag_weighted_matches = 0.0
    any_weighted_matches = 0.0

    has_high_value_term = any(get_term_weight(t) > 1.5 for t in q_unique)
    matched_high_value_term = False

    for term in q_unique:
        weight = get_term_weight(term)
        matched = False

        in_title = _match_term(term, title_tokens, title_text)
        in_tags = any(term == t or stem_token(term) == stem_token(t) or _match_term(term, [t], t) for t in tags)
        in_abstract = _match_term(term, abstract_tokens, abstract_text)

        if in_title:
            title_weighted_matches += weight
            matched = True
        if in_tags:
            tag_weighted_matches += weight
            matched = True
        if in_abstract:
            abstract_weighted_matches += weight
            matched = True

        if matched:
            any_weighted_matches += weight
            if weight > 1.5:
                matched_high_value_term = True

    # Strict academic filter: If the query had specific high-value terms (e.g. 'diagram'),
    # but the paper did not match ANY high-value term, heavily penalize or zero out
    if has_high_value_term and not matched_high_value_term:
        return 0.0

    if any_weighted_matches == 0:
        return 0.0

    title_cov = title_weighted_matches / total_weighted_query
    abstract_cov = abstract_weighted_matches / total_weighted_query
    tag_cov = tag_weighted_matches / total_weighted_query
    overall_cov = any_weighted_matches / total_weighted_query

    # Weighted lexical base
    base_lexical = (0.45 * title_cov) + (0.35 * abstract_cov) + (0.10 * tag_cov) + (0.10 * overall_cov)

    # Title anchor boost
    if title_cov >= 0.5:
        title_floor = 0.65 + (0.20 * title_cov)
        base_lexical = max(base_lexical, title_floor + (0.10 * abstract_cov) + (0.10 * tag_cov))

    # Phrase co-occurrence boost
    title_phrase_bonus = _check_phrase_cooccurrence(q_tokens, title_text) * 1.5
    abs_phrase_bonus = _check_phrase_cooccurrence(q_tokens, abstract_text)
    base_lexical = min(1.0, base_lexical + title_phrase_bonus + abs_phrase_bonus)

    # Full title match ceiling
    if title_cov == 1.0 and (abstract_cov > 0 or tag_cov > 0 or title_phrase_bonus > 0):
        base_lexical = max(base_lexical, 0.96)

    # Honest linear lexical score (no artificial exponentiation like ** 0.65)
    lexical = min(1.0, base_lexical)

    # Recency & Impact signals
    current_year = datetime.now().year
    year = paper.get("year", current_year)
    recency = min(1.0, max(0.0, (year - 2018) / 8.0))

    citations = paper.get("citations", 0)
    impact = min(1.0, math.log10(citations + 1) / 3.5)

    # Recent papers (< 18 months) aren't penalized for low citation count
    is_recent = (current_year - year) <= 1

    semantic = semantic_similarity(query_embedding, paper.get("embedding"))
    if semantic > 0:
        if is_recent:
            score = lexical * 0.65 + semantic * 0.25 + recency * 0.10
        else:
            score = lexical * 0.55 + semantic * 0.25 + recency * 0.10 + impact * 0.10
    else:
        if is_recent:
            score = lexical * 0.88 + recency * 0.12
        else:
            score = lexical * 0.80 + recency * 0.10 + impact * 0.10

    return min(0.99, round(score, 4))


def rank_papers(
    query: str, papers: list[dict], query_embedding: list[float] | None = None, min_relevance: float = 0.0
) -> list[dict]:
    """Assign relevance score, filter by min_relevance, and sort papers descending."""
    ranked = []
    for p in papers:
        p_copy = dict(p)
        score = similarity(query, p_copy, query_embedding)
        if score >= min_relevance:
            p_copy["relevance"] = score
            ranked.append(p_copy)
    ranked.sort(key=lambda x: x["relevance"], reverse=True)
    return ranked