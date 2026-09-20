"""Search prompts — placeholder stub.

NOTE: This file is intentionally minimal. The Discover-page search path
does NOT use a prompt-based LLM call for the primary search step; it uses
the arXiv / Semantic Scholar APIs directly (see paper_service.py) and then
applies rule-based or LLM-parsed *filters* via discover_filter_service.py.

If a future sprint adds an LLM-reranking or query-expansion step to the
search pipeline, place the system prompt and build_prompt() function here.
"""
from __future__ import annotations
