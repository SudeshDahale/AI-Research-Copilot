"""Discover-page chat endpoint.

Helps users narrow search results down before creating a workspace. Distinct
from /agent (the workspace analysis chat) on purpose — different job, no
SSE streaming needed, and no fast/deep pipeline machinery, because nothing
here does multi-paragraph generation.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.schemas.discover import DiscoverChatRequest, DiscoverChatResponse
from app.agents.discover_router import detect_discover_intent
from app.services import discover_filter_service
from app.services.paper_service import search_papers
from app.services.ranking_service import rank_papers
from app.core.cache import cached_search
from app.core.logging import logger

router = APIRouter()


@router.post("/chat", response_model=DiscoverChatResponse)
async def discover_chat(
    payload: DiscoverChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> DiscoverChatResponse:
    message = payload.message.strip()
    candidates = [p.model_dump() for p in payload.candidates]

    intent, extra = detect_discover_intent(message)
    logger.info(f"discover_chat: intent={intent!r} candidates={len(candidates)}")

    if intent == "top_n":
        n = extra["n"]
        papers = discover_filter_service.top_n(candidates, n)
        reply = f"Here are the top {len(papers)} most relevant papers."
        return DiscoverChatResponse(reply=reply, papers=papers, action="top_n")

    if intent == "search":
        query = message
        raw_papers, _ = await cached_search(query, search_papers)
        # Deliberately skip embedding here (Voyage's free-tier rate limit is
        # very tight — see Sprint 8 notes); lexical/recency ranking alone is
        # plenty for a quick chat-driven search and keeps this call fast.
        ranked = rank_papers(query, raw_papers, None)
        reply = f"Found {len(ranked)} papers for '{query}'."
        return DiscoverChatResponse(reply=reply, papers=ranked, action="search")

    if intent == "add_to_workspace":
        # No backend logic needed — frontend already has the current
        # `candidates` selection and should call the existing
        # POST /workspaces or POST /workspaces/{id}/papers endpoint directly,
        # same as the existing "Add to workspace" button does.
        reply = "Ready to add these papers — confirm the workspace name to continue."
        return DiscoverChatResponse(reply=reply, papers=candidates, action="add_to_workspace")

    # Fallback: natural-language filter — the one path with an LLM call.
    filt = await discover_filter_service.extract_filter(message)
    papers = discover_filter_service.apply_filter(candidates, filt)
    if not papers and candidates:
        reply = "No papers matched that filter — try loosening it (e.g. a wider year range)."
    else:
        reply = f"Narrowed down to {len(papers)} papers matching your request."
    return DiscoverChatResponse(reply=reply, papers=papers, action="filter")