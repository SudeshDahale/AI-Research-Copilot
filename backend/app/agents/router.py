import re
from app.services import llm_service
from app.core.logging import logger

def detect_intent_rules(query: str) -> str | None:
    """Fast rule-based matching for query intents. Returns None if ambiguous."""
    q = query.lower().strip()

    # 1. Gaps
    gap_keywords = [
        r"\bgaps?\b", r"\bmissing\b", r"\bfuture work\b", r"\bunaddressed\b",
        r"\bunderexplored\b", r"\bunder-explored\b", r"\blimitations?\b",
        r"\bwhat is missing\b", r"\bwhat's missing\b"
    ]
    if any(re.search(kw, q) for kw in gap_keywords):
        return "gaps"

    # 2. Lit Review
    review_keywords = [
        r"\bliterature review\b", r"\blit review\b", r"\brelated work\b",
        r"\bsynthesis\b", r"\bdraft\b", r"\bwrite up\b"
    ]
    if any(re.search(kw, q) for kw in review_keywords):
        return "literature_review"

    # 3. Compare
    compare_keywords = [
        r"\bcompare\b", r"\bcomparison\b", r"\bdifferences between\b",
        r"\bmethodolog(y|ies)\b", r"\bcontrast\b", r"\bvs\b"
    ]
    if any(re.search(kw, q) for kw in compare_keywords):
        return "compare"

    # 4. Contradictions
    contradict_keywords = [
        r"\bcontradict\b", r"\bcontradictions?\b", r"\bconflict\b",
        r"\bdisagree\b", r"\binconsistent\b", r"\bclash\b"
    ]
    if any(re.search(kw, q) for kw in contradict_keywords):
        return "contradictions"

    # 5. Summary
    summary_keywords = [
        r"\bsummar(y|ize)\b", r"\boverview\b", r"\bconsensus\b",
        r"\bkey findings\b"
    ]
    if any(re.search(kw, q) for kw in summary_keywords):
        return "summary"

    return None


async def detect_intent(query: str) -> str:
    """Classifies user query intent using fast rules or Groq LLM fallback."""
    # 1. Fast Rules
    intent = detect_intent_rules(query)
    if intent:
        logger.info(f"detect_intent: rule-based match found intent={intent!r} for query={query!r}")
        return intent

    # 2. LLM Fallback
    # Sprint 9: switched off groq/compound-mini. Compound models are agentic
    # (they can call web search / code execution internally) which adds real
    # latency to what should be a one-word classification call. gpt-oss-20b
    # is Groq's plain fast model and is also the currently-supported
    # replacement for the now-deprecated llama-3.1-8b-instant.
    logger.info(f"detect_intent: falling back to LLM for classification: query={query!r}")
    system_prompt = (
        "You are an AI router. Classify the user's research query into one of these intents:\n"
        "- 'summary' (summarize papers, overview, consensus)\n"
        "- 'gaps' (research gaps, missing work, limitations)\n"
        "- 'compare' (compare methodologies, methods, datasets)\n"
        "- 'contradictions' (disagreements, conflicting findings, inconsistencies)\n"
        "- 'literature_review' (literature review, related work, synthesis)\n"
        "- 'generic' (general questions, simple answers)\n"
        "\n"
        "Return ONLY the intent name in lowercase as a raw string (e.g. 'summary'). No explanation, no markdown tags."
    )
    try:
        res = await llm_service.generate_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            model="openai/gpt-oss-20b",
            max_tokens=10,
            temperature=0.0
        )
        if res:
            classified = res.strip().lower().replace("'", "").replace('"', "")
            if classified in ("summary", "gaps", "compare", "contradictions", "literature_review", "generic"):
                logger.info(f"detect_intent: LLM classified intent={classified!r}")
                return classified
    except Exception as exc:
        logger.warning(f"detect_intent LLM fallback failed: {exc}")

    return "generic"