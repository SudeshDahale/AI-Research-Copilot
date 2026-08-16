"""LangGraph wiring - Sprint 7.

Every task runs: search -> ranking -> clustering -> summarize, then branches:
  - "gaps"       -> gap_detection -> compose
  - "lit_review" -> gap_detection -> lit_review -> compose
  - anything else -> compose directly
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.nodes.search_node import search_node
from app.agents.nodes.ranking_node import ranking_node
from app.agents.nodes.clustering_node import clustering_node
from app.agents.nodes.summarize_node import summarize_node
from app.agents.nodes.gap_detection_node import gap_detection_node
from app.agents.nodes.lit_review_node import lit_review_node


def detect_task(query: str) -> str:
    q = query.lower()
    if "gap" in q or "missing" in q or "under" in q:
        return "gaps"
    if "literature review" in q or "related work" in q or "draft" in q:
        return "lit_review"
    if "compare" in q or "method" in q:
        return "compare"
    if "contradict" in q or "conflict" in q:
        return "contradictions"
    if "summar" in q:
        return "summary"
    return "generic"


def _route_after_summarize(state: AgentState) -> str:
    if state.get("task") in ("gaps", "lit_review"):
        return "gap_detection"
    return "compose"


def _route_after_gaps(state: AgentState) -> str:
    if state.get("task") == "lit_review":
        return "lit_review"
    return "compose"


async def compose_node(state: AgentState) -> dict:
    task = state.get("task", "generic")
    papers = state.get("ranked_papers") or state.get("papers") or []
    summary = state.get("corpus_summary") or {}
    gaps = state.get("gaps") or []
    lit_review = state.get("lit_review", "")

    def paper_list(n: int = 8) -> str:
        return "\n".join(
            f"  [{i + 1}] {(p.get('authors') or ['Anon'])[0]} et al. "
            f"({p.get('year', '?')}). {p.get('title', '')}. {p.get('journal', '')}."
            for i, p in enumerate(papers[:n])
        )

    if not papers:
        return {"final_text": "No papers in scope yet - add some to this workspace first."}

    if task == "gaps":
        gap_md = "\n\n".join(f"**{i + 1}.** {g}" for i, g in enumerate(gaps))
        text = f"## Research gaps\n{summary.get('overview', '')}\n\n{gap_md}\n\n### Corpus analyzed\n{paper_list()}"
    elif task == "lit_review":
        text = f"## Literature review\n\n### Narrative\n{lit_review}\n\n### References\n{paper_list(10)}"
    elif task == "summary":
        themes = ", ".join(summary.get("themes", []))
        text = (
            f"## Summary\n\n{summary.get('overview', '')}\n\n"
            f"**Themes:** {themes}\n\n**Consensus:** {summary.get('consensus', '')}\n\n"
            f"### Papers\n{paper_list()}"
        )
    else:
        text = f"{summary.get('overview', '')}\n\n**Consensus:** {summary.get('consensus', '')}"

    return {"final_text": text}


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("search", search_node)
    builder.add_node("ranking", ranking_node)
    builder.add_node("clustering", clustering_node)
    builder.add_node("summarize", summarize_node)
    builder.add_node("gap_detection", gap_detection_node)
    builder.add_node("lit_review", lit_review_node)
    builder.add_node("compose", compose_node)

    builder.set_entry_point("search")
    builder.add_edge("search", "ranking")
    builder.add_edge("ranking", "clustering")
    builder.add_edge("clustering", "summarize")
    builder.add_conditional_edges(
        "summarize", _route_after_summarize, {"gap_detection": "gap_detection", "compose": "compose"}
    )
    builder.add_conditional_edges(
        "gap_detection", _route_after_gaps, {"lit_review": "lit_review", "compose": "compose"}
    )
    builder.add_edge("lit_review", "compose")
    builder.add_edge("compose", END)

    return builder.compile()


agent_graph = build_graph()