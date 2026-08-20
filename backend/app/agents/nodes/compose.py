"""Compose node — Sprint 8.

Intent-aware: reads state["result"] and formats a final markdown response
tailored to the specific intent. No generic fallback that silently treats
unknown intents as summaries.
"""
from __future__ import annotations

from app.agents.state import AgentState
from app.core.logging import logger


def _paper_ref(p: dict, idx: int) -> str:
    authors = p.get("authors") or ["Unknown"]
    first_author = authors[0] if authors else "Unknown"
    return (
        f"[{idx}] {first_author} et al. ({p.get('year', '?')}). "
        f"*{p.get('title', 'Untitled')}*. {p.get('journal', '')}."
    )


def _reference_list(papers: list[dict], n: int = 10) -> str:
    return "\n".join(_paper_ref(p, i + 1) for i, p in enumerate(papers[:n]))


async def compose_node(state: AgentState) -> dict:
    intent = state.get("intent", "generic")
    papers = state.get("papers") or []
    result = state.get("result") or {}
    error = state.get("error")

    # ── Error states ─────────────────────────────────────────────────────────
    if error == "empty_workspace":
        return {
            "final_text": (
                "⚠️ **Empty workspace**\n\n"
                "This workspace has no papers yet. "
                "Add papers to your workspace first, then run the agent again."
            )
        }

    if error:
        return {"final_text": f"⚠️ **Error**: {error}"}

    if not papers:
        return {
            "final_text": (
                "No papers found in scope. "
                "Try adding papers to your workspace or broadening your query."
            )
        }

    refs = _reference_list(papers)

    # ── Summary ──────────────────────────────────────────────────────────────
    if intent == "summary":
        overview = result.get("overview", "")
        themes = result.get("themes", [])
        key_findings = result.get("key_findings", [])

        themes_md = "  ".join(f"`{t}`" for t in themes) if themes else "_None identified_"
        findings_md = (
            "\n".join(f"- {f}" for f in key_findings) if key_findings else "_None identified_"
        )

        text = (
            f"## Research Summary\n\n"
            f"{overview}\n\n"
            f"**Themes:** {themes_md}\n\n"
            f"### Key Findings\n{findings_md}\n\n"
            f"### Corpus ({len(papers)} papers)\n{refs}"
        )

    # ── Research Gaps ────────────────────────────────────────────────────────
    elif intent == "gaps":
        gaps = result.get("gaps", [])

        if not gaps:
            gaps_md = "_No clear gaps identified from this corpus._"
        else:
            parts = []
            for i, g in enumerate(gaps, 1):
                if isinstance(g, dict):
                    title = g.get("title", f"Gap {i}")
                    desc = g.get("description", "")
                    supporting = g.get("supporting_papers", [])
                    sup_md = (
                        f"\n  > *Evidence from:* {', '.join(supporting)}" if supporting else ""
                    )
                    parts.append(f"**{i}. {title}**\n{desc}{sup_md}")
                else:
                    parts.append(f"**{i}.** {g}")
            gaps_md = "\n\n".join(parts)

        text = (
            f"## Research Gaps\n\n"
            f"{gaps_md}\n\n"
            f"### Corpus Analyzed ({len(papers)} papers)\n{refs}"
        )

    # ── Methodology Comparison ───────────────────────────────────────────────
    elif intent == "compare":
        comparisons = result.get("comparisons", [])
        note = result.get("_note", "")

        if note:
            text = f"## Methodology Comparison\n\n_{note}_\n\n### Papers\n{refs}"
        elif not comparisons:
            text = (
                f"## Methodology Comparison\n\n"
                f"_No distinct methodologies identified across this corpus._\n\n"
                f"### Papers\n{refs}"
            )
        else:
            # Build a comparison table
            table_rows = ["| Method | Papers | Strengths | Weaknesses |", "|---|---|---|---|"]
            for c in comparisons:
                method = c.get("method", "Unknown")
                comp_papers = ", ".join(c.get("papers", []))
                strengths = "; ".join(c.get("strengths", []))
                weaknesses = "; ".join(c.get("weaknesses", []))
                table_rows.append(f"| {method} | {comp_papers} | {strengths} | {weaknesses} |")

            table_md = "\n".join(table_rows)

            # Differences narrative
            diffs = []
            for c in comparisons:
                if c.get("differences"):
                    diffs.append(
                        f"**{c.get('method')}**: {'; '.join(c['differences'])}"
                    )
            diffs_md = "\n\n".join(diffs) if diffs else ""

            text = (
                f"## Methodology Comparison\n\n"
                f"{table_md}\n\n"
                + (f"### Key Differences\n{diffs_md}\n\n" if diffs_md else "")
                + f"### Corpus ({len(papers)} papers)\n{refs}"
            )

    # ── Contradictions ───────────────────────────────────────────────────────
    elif intent == "contradictions":
        contradictions = result.get("contradictions", [])
        note = result.get("_note", "")

        if note:
            text = f"## Contradictions\n\n_{note}_\n\n### Papers\n{refs}"
        elif not contradictions:
            text = (
                f"## Contradictions\n\n"
                f"✅ **No genuine contradictions found** in this corpus. "
                f"The papers appear to be broadly consistent in their claims.\n\n"
                f"### Corpus ({len(papers)} papers)\n{refs}"
            )
        else:
            parts = []
            for i, c in enumerate(contradictions, 1):
                topic = c.get("topic", f"Topic {i}")
                pa = c.get("paper_a", "Paper A")
                pb = c.get("paper_b", "Paper B")
                ca = c.get("claim_a", "")
                cb = c.get("claim_b", "")
                diff = c.get("difference", "")
                evidence = c.get("evidence", "")

                parts.append(
                    f"### {i}. {topic}\n\n"
                    f"- **{pa}** claims: {ca}\n"
                    f"- **{pb}** claims: {cb}\n\n"
                    f"**Disagreement:** {diff}\n\n"
                    + (f"> {evidence}\n" if evidence else "")
                )

            text = (
                f"## Contradictions Found ({len(contradictions)})\n\n"
                + "\n\n".join(parts)
                + f"\n\n### Corpus ({len(papers)} papers)\n{refs}"
            )

    # ── Literature Review ────────────────────────────────────────────────────
    elif intent == "literature_review":
        introduction = result.get("introduction", "")
        themes = result.get("themes", [])
        discussion = result.get("discussion", "")
        research_gaps = result.get("research_gaps", [])
        conclusion = result.get("conclusion", "")

        themes_md = ""
        if themes:
            for t in themes:
                if isinstance(t, dict):
                    themes_md += f"#### {t.get('label', 'Theme')}\n{t.get('summary', '')}\n\n"
                else:
                    themes_md += f"- {t}\n"

        gaps_md = "\n".join(f"- {g}" for g in research_gaps) if research_gaps else ""

        text = (
            f"## Literature Review\n\n"
            f"### Introduction\n{introduction}\n\n"
            + (f"### Themes\n{themes_md}" if themes_md else "")
            + f"### Discussion\n{discussion}\n\n"
            + (f"### Research Gaps\n{gaps_md}\n\n" if gaps_md else "")
            + f"### Conclusion\n{conclusion}\n\n"
            + f"### References ({len(papers)} papers)\n{refs}"
        )

    # ── Generic fallback ─────────────────────────────────────────────────────
    else:
        overview = result.get("overview", "")
        logger.warning(f"compose_node: unhandled intent={intent!r}, using generic overview")
        text = (
            f"## Analysis\n\n"
            f"{overview or 'Analysis complete.'}\n\n"
            f"### Papers ({len(papers)})\n{refs}"
        )

    return {"final_text": text}
