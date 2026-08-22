"""LangGraph agent graph — Sprint 8.

New routing logic:
  START → retrieve → [intent-specific node] → compose → END

Only the required analysis node executes per query.
The old sequential search→ranking→clustering→summarize→gap chain is removed.

Intent routing uses router.detect_intent() (not the old fragile detect_task()).
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.nodes.retrieve import retrieve_node
from app.agents.nodes.summary import summary_node
from app.agents.nodes.gaps import gaps_node
from app.agents.nodes.compare import compare_node
from app.agents.nodes.contradiction import contradiction_node
from app.agents.nodes.review import review_node
from app.agents.nodes.compose import compose_node
from app.core.logging import logger


# ---------------------------------------------------------------------------
# Routing functions
# ---------------------------------------------------------------------------

def _route_after_retrieve(state: AgentState) -> str:
    """After retrieval, skip to compose on error, else route to intent node."""
    error = state.get("error")
    if error in ("empty_workspace",) or (error and not state.get("papers")):
        # Skip analysis — compose will render the appropriate error message.
        return "compose"

    intent = state.get("intent", "generic")
    route_map = {
        "summary": "summary",
        "gaps": "gaps",
        "compare": "compare",
        "contradictions": "contradictions",
        "literature_review": "review",
        "generic": "summary",  # generic falls back to a summary
    }
    chosen = route_map.get(intent, "summary")
    logger.info(f"graph: routing intent={intent!r} -> {chosen}")
    return chosen


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    # Nodes
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("summary", summary_node)
    builder.add_node("gaps", gaps_node)
    builder.add_node("compare", compare_node)
    builder.add_node("contradictions", contradiction_node)
    builder.add_node("review", review_node)
    builder.add_node("compose", compose_node)

    # Entry
    builder.set_entry_point("retrieve")

    # Conditional dispatch after retrieve
    builder.add_conditional_edges(
        "retrieve",
        _route_after_retrieve,
        {
            "summary": "summary",
            "gaps": "gaps",
            "compare": "compare",
            "contradictions": "contradictions",
            "review": "review",
            "compose": "compose",  # error shortcut
        },
    )

    # Each analysis node flows to compose
    builder.add_edge("summary", "compose")
    builder.add_edge("gaps", "compose")
    builder.add_edge("compare", "compose")
    builder.add_edge("contradictions", "compose")
    builder.add_edge("review", "compose")
    builder.add_edge("compose", END)

    return builder.compile()


agent_graph = build_graph()