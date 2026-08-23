"""Schemas for the Discover-page chat assistant.

This assistant helps users narrow down search results before creating a
workspace — it does NOT do paper analysis (that's the separate, existing
workspace chat in agents/graph.py). Kept intentionally simple: no streaming,
mostly no LLM calls at all.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.search import PaperSchema


class DiscoverChatRequest(BaseModel):
    message: str = Field(..., description="User's chat message, e.g. 'top 5' or 'only 2024 papers on diffusion'")
    query: str = Field(default="", description="The original search query that produced `candidates`")
    candidates: list[PaperSchema] = Field(
        default_factory=list,
        description="The current search result set the user is chatting about (frontend keeps this in state and resends it each turn)",
    )


class DiscoverChatResponse(BaseModel):
    reply: str
    papers: list[PaperSchema]
    action: str  # "top_n" | "filter" | "search" | "add_to_workspace" | "unknown"