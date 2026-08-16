"""LLM Service using Groq Cloud (Free high-speed inference)."""
from __future__ import annotations

import json
from typing import Any
from groq import AsyncGroq

from app.config import settings
from app.core.logging import logger

_client: AsyncGroq | None = None


def get_llm_client() -> AsyncGroq | None:
    global _client
    api_key = settings.groq_api_key or settings.llm_api_key
    if not api_key:
        return None
    if _client is None:
        _client = AsyncGroq(api_key=api_key)
    return _client


async def generate_chat_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
    response_format: dict[str, str] | None = None,
) -> str | None:
    """Generate a chat completion using Groq."""
    client = get_llm_client()
    if not client:
        logger.warning("GROQ_API_KEY / LLM_API_KEY not set — skipping LLM generation.")
        return None

    chosen_model = model or settings.llm_model or "llama-3.3-70b-versatile"
    kwargs: dict[str, Any] = {
        "model": chosen_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format

    try:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    except Exception as exc:
        logger.error(f"Groq completion failed: {exc}", exc_info=True)
        return None


async def analyze_paper_abstract(title: str, abstract: str) -> dict[str, Any] | None:
    """Extract structured objective, methodology, dataset, results, limitations, gaps, and future work."""
    system_prompt = (
        "You are an expert scientific researcher. Analyze the research paper title and abstract provided. "
        "Return a valid JSON object with the following schema:\n"
        "{\n"
        '  "objective": "1-2 sentences on what problem is addressed",\n'
        '  "methodology": "1-2 sentences on how it was done",\n'
        '  "dataset": "Datasets or benchmarks used (if mentioned)",\n'
        '  "results": "Key findings or metrics achieved",\n'
        '  "limitations": "Any stated limitations or drawbacks",\n'
        '  "gaps": ["1-3 research gaps identified"],\n'
        '  "future": ["1-3 future directions proposed"]\n'
        "}"
    )
    user_prompt = f"Title: {title}\n\nAbstract: {abstract}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    raw_response = await generate_chat_completion(
        messages=messages,
        response_format={"type": "json_object"},
    )
    if not raw_response:
        return None

    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        return None
