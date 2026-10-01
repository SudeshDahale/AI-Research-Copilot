"""Fast Pipeline — Real-Time Scientific AI Response Engine.

Delivers comprehensive, accurate, and deeply grounded scientific answers via real-time token streaming.
Uses full-fidelity paper context (abstracts, methodologies, findings, citations).
"""
from __future__ import annotations

import time
from typing import Any, AsyncIterator

from app.agents.distillation import distill_papers_context
from app.core.logging import logger
from app.services.llm_service import stream_completion


_FAST_SYSTEM_PROMPT = """You are an expert scientific AI research assistant (like Consensus/Perplexity Academic).
Your goal is to answer the researcher's query directly, accurately, and authoritatively based on the scientific papers provided in context.

Guidelines:
1. Ground your answer strictly in the provided paper context (abstracts, findings, methods, citations).
2. Directly answer what the user asked:
   - If they ask for a comparison, contrast the methodologies, datasets, and benchmark metrics with citations.
   - If they ask for research gaps, highlight specific open challenges and missing areas.
   - If they ask for datasets or metrics, cite the specific numbers or benchmarks mentioned.
   - If they ask for a table or matrix, format with clean Markdown table syntax (| Col 1 | Col 2 |).
   - If they ask for a summary, provide a structured overview with key takeaways.
3. Cite paper titles, authors, and publication years (e.g. *Vaswani et al. (2017)*).
4. Be precise, concise, and scientifically rigorous. Do not add meta-disclaimers or conversational fluff."""


async def stream_fast_pipeline(
    query: str,
    papers: list[dict[str, Any]],
    intent: str = "generic",
    max_papers: int = 8,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[str]:
    """Stream token chunks for the fast response with full paper context."""
    t0 = time.monotonic()
    
    # 1. Format rich paper context
    papers_context = distill_papers_context(papers, max_papers=max_papers)
    
    # 2. Build prompt with history
    history_context = ""
    if history:
        formatted = []
        for msg in history[-4:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            snippet = msg.get("content", "").strip()
            if len(snippet) > 250:
                snippet = snippet[:250] + "..."
            formatted.append(f"{role}: {snippet}")
        if formatted:
            history_context = "Recent Conversation Context:\n" + "\n".join(formatted) + "\n\n"

    user_prompt = (
        f"{history_context}"
        f"Research Question / Command: {query}\n\n"
        f"Active Research Papers Context:\n{papers_context}\n\n"
        f"Provide a comprehensive, accurate, and structured scientific answer to the question:"
    )
    
    messages = [
        {"role": "system", "content": _FAST_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    
    logger.info(f"fast_pipeline: starting stream for query={query!r}, papers={min(len(papers), max_papers)}")
    
    token_count = 0
    async for chunk in stream_completion(
        messages,
        model="qwen/qwen3.8-27b",
        max_tokens=2000,
        temperature=0.2,
        reasoning_format="hidden",
        reasoning_effort="none",
    ):
        token_count += 1
        yield chunk

    if token_count == 0 and papers:
        top_p = papers[0]
        title = top_p.get("title", "Selected paper")
        abstract = top_p.get("abstract", "Relevant scientific literature provides insights on this query.")
        fallback_text = f"Based on {title}: {abstract}"
        for part in fallback_text.split(" "):
            yield part + " "
        token_count = len(fallback_text.split(" "))

    elapsed_ms = round((time.monotonic() - t0) * 1000)
    logger.info(f"fast_pipeline: completed stream in {elapsed_ms}ms (~{token_count} chunks)")
