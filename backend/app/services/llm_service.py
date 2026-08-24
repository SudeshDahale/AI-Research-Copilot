"""LLM Service using Groq Cloud (Free high-speed inference)."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator
import httpx
from groq import AsyncGroq

from app.config import settings
from app.core.logging import logger

_GROQ_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=5.0)


def get_llm_client() -> AsyncGroq | None:
    api_key = settings.groq_api_key or settings.llm_api_key
    if not api_key:
        return None
    return AsyncGroq(api_key=api_key, timeout=_GROQ_TIMEOUT)


async def generate_chat_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
    response_format: dict[str, str] | None = None,
    max_tokens: int | None = None,
) -> str | None:
    """Generate a chat completion using Groq."""
    client = get_llm_client()
    if not client:
        logger.warning("GROQ_API_KEY / LLM_API_KEY not set — skipping LLM generation.")
        return None

    chosen_model = model or settings.llm_model or "openai/gpt-oss-120b"
    kwargs: dict[str, Any] = {
        "model": chosen_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

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
        max_tokens=1024,
    )
    if not raw_response:
        return None

    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        return None


async def generate_structured_json(
    system: str,
    prompt: str,
    schema_hint: str,
    model: str | None = None,
    max_tokens: int = 2048,
) -> dict[str, Any] | None:
    """Generic structured-output helper for agent nodes.

    Groq's JSON mode (response_format={"type": "json_object"}) guarantees
    valid JSON but doesn't accept a schema like tool-calling APIs do, so the
    shape has to be spelled out in the prompt itself. schema_hint is that
    spelled-out shape, appended to the system prompt.

    model: pass the fast model for routine tasks (summary/gaps/compare/
    contradictions) and leave as None (→ the big default model) only for
    tasks that genuinely need deeper synthesis, like literature_review.

    max_tokens: defaults to 2048, generous for short structured objects.
    Pass a higher value (e.g. 3000) for nodes producing longer prose, like
    literature review.
    """
    messages = [
        {"role": "system", "content": f"{system}\n\nReturn a valid JSON object with this shape:\n{schema_hint}"},
        {"role": "user", "content": prompt},
    ]
    raw = await generate_chat_completion(
        messages=messages,
        model=model,
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
    )
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"generate_structured_json: model did not return valid JSON: {raw[:200]!r}")
        return None


async def stream_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.3,
    reasoning_format: str | None = None,
    reasoning_effort: str | None = None,
) -> AsyncIterator[str]:
    """Yield text token-chunks as they arrive from Groq.

    Usage (in an async generator):
        async for chunk in stream_completion(messages):
            yield {"event": "token", "data": {"chunk": chunk}}
    """
    client = get_llm_client()
    if not client:
        logger.warning("stream_completion: no API key — yielding nothing.")
        return

    chosen_model = model or settings.llm_model or "openai/gpt-oss-120b"
    kwargs: dict[str, Any] = {
        "model": chosen_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if reasoning_format:
        kwargs["reasoning_format"] = reasoning_format
    if reasoning_effort:
        kwargs["reasoning_effort"] = reasoning_effort

    try:
        response = await client.chat.completions.create(**kwargs)
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                delta_content = chunk.choices[0].delta.content
                if delta_content:
                    yield delta_content
    except Exception as exc:
        logger.error(f"stream_completion failed: {exc}", exc_info=True)
        return