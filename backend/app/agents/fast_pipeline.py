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


_FAST_SYSTEM_PROMPT = """You are an intelligent, responsive scientific AI research assistant (ChatGPT/Claude style).
Your goal is to answer the user's specific research query directly, accurately, and comprehensively based on the paper insights provided below.
- Strictly adhere to any formatting requested: if the user asks for a table, tabular form, or comparison matrix, format the output as a clean, complete Markdown table with clear column headers (| Column 1 | Column 2 | ...).
- If the user asks for a specific comparison, summary, bullet list, or analysis, provide the answer in that exact requested format.
- Cite paper titles, authors, and publication years where relevant.
- Do not add meta-disclaimers or conversational fluff; provide high-value, crisp scientific insights."""


async def stream_fast_pipeline(
    query: str,
    papers: list[dict[str, Any]],
    intent: str = "generic",
    max_papers: int = 5,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[str]:
    """Stream token chunks for the fast response."""
    t0 = time.monotonic()
    
    # 1. Distill context (Top 3-5 papers)
    distilled_context = distill_papers_context(papers, max_papers=max_papers)
    
    # 2. Build concise prompt with compressed recent history if available
    history_context = ""
    if history:
        formatted = []
        for msg in history[-4:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            snippet = msg.get("content", "").strip()
            if len(snippet) > 150:
                snippet = snippet[:150] + "..."
            formatted.append(f"{role}: {snippet}")
        if formatted:
            history_context = "Recent Conversation Context:\n" + "\n".join(formatted) + "\n\n"

    user_prompt = (
        f"{history_context}"
        f"Query: {query}\n\n"
        f"Key Distilled Papers Context:\n{distilled_context}\n\n"
        f"Synthesize an immediate, structured answer to the query:"
    )
    
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
        max_tokens=1500,
        temperature=0.2,
        reasoning_format="hidden",
        reasoning_effort="none",
    ):
        token_count += 1
        yield chunk

    elapsed_ms = round((time.monotonic() - t0) * 1000)
    logger.info(f"fast_pipeline: completed stream in {elapsed_ms}ms (~{token_count} chunks)")
