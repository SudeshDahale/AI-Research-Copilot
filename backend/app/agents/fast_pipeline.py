"""Fast Pipeline — UX Engine for Instant Responses.

Delivers a crisp, synthesized response within 1–2 seconds via real-time token streaming.
Uses the Context Distillation Layer and strict token budgeting.
"""
from __future__ import annotations

import time
from typing import Any, AsyncIterator

from app.agents.distillation import distill_papers_context
from app.core.logging import logger
from app.services.llm_service import stream_completion


_FAST_SYSTEM_PROMPT = """You are an ultra-fast scientific research assistant.
Provide a concise, direct, high-value answer (2–3 short paragraphs or clean bullet points) addressing the user's research query based strictly on the distilled paper insights below.
Avoid fluff, meta-introductions, or long disclaimers. Prioritize clear takeaways and cite the paper titles/years where relevant."""


async def stream_fast_pipeline(
    query: str,
    papers: list[dict[str, Any]],
    intent: str = "generic",
    max_papers: int = 5,
) -> AsyncIterator[str]:
    """Stream token chunks for the fast response."""
    t0 = time.monotonic()
    
    # 1. Distill context (Top 3-5 papers)
    distilled_context = distill_papers_context(papers, max_papers=max_papers)
    
    # 2. Build concise prompt
    user_prompt = f"Query: {query}\n\nKey Distilled Papers Context:\n{distilled_context}\n\nSynthesize an immediate, structured answer to the query:"
    
    messages = [
        {"role": "system", "content": _FAST_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    
    # 3. Stream tokens with capped output
    logger.info(f"fast_pipeline: starting token stream for intent={intent!r}, papers={min(len(papers), max_papers)}")
    
    token_count = 0
    async for chunk in stream_completion(
        messages,
        model="qwen/qwen3.6-27b",
        max_tokens=600,
        temperature=0.2,
        reasoning_format="hidden",
        reasoning_effort="none",
    ):
        token_count += 1
        yield chunk

    elapsed_ms = round((time.monotonic() - t0) * 1000)
    logger.info(f"fast_pipeline: completed stream in {elapsed_ms}ms (~{token_count} chunks)")
