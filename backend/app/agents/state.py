"""Agent state — Sprint 8.

Simplified: single `result` dict populated by whichever analysis node runs.
Embeddings are never carried here (stripped in retrieve.py before this point).
"""
from __future__ import annotations

from typing import TypedDict


class AgentState(TypedDict, total=False):
    # ── Input ────────────────────────────────────────────────────────────────
    query: str
    workspace_id: str | None
    intent: str  # "summary"|"gaps"|"compare"|"contradictions"|"literature_review"|"generic"

    # ── Populated by retrieve.py ─────────────────────────────────────────────
    # Embeddings are stripped before reaching here — never sent to LLM nodes.
    papers: list[dict]

    # ── Populated by whichever single analysis node runs ─────────────────────
    result: dict

    # ── Populated by compose.py ──────────────────────────────────────────────
    final_text: str

    # ── Timing/perf (populated incrementally) ────────────────────────────────
    metrics: dict

    # ── Error propagation ────────────────────────────────────────────────────
    error: str