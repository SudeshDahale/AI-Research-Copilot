"""Shared state carried through the LangGraph agent - Sprint 7."""
from __future__ import annotations

from typing import TypedDict


class Cluster(TypedDict):
    theme: str
    paper_ids: list[str]


class AgentState(TypedDict, total=False):
    # Input
    query: str
    workspace_id: str | None
    task: str  # "gaps" | "lit_review" | "summary" | "compare" | "contradictions" | "generic"

    # Populated by search_node
    papers: list[dict]

    # Populated by ranking_node
    ranked_papers: list[dict]

    # Populated by clustering_node
    clusters: list[Cluster]

    # Populated by summarize_node
    corpus_summary: dict

    # Populated by gap_detection_node
    gaps: list[str]

    # Populated by lit_review_node
    lit_review: str

    # Populated by the final compose step
    final_text: str

    error: str