import type { Paper } from "@/lib/mock-data";

export const AGENT_TASKS = [
  "Find research gaps",
  "Write literature review",
  "Summarize corpus",
  "Compare methodologies",
  "Find contradictions",
] as const;

function paperList(papers: Paper[], n = 8) {
  return papers
    .slice(0, n)
    .map((p, i) => `  [${i + 1}] ${p.authors[0] ?? "Anon"} et al. (${p.year}). ${p.title}. ${p.journal}.`)
    .join("\n");
}

export function buildAgentReply(question: string, papers: Paper[], scope: string): string {
  const q = question.toLowerCase();
  if (!papers.length)
    return `No papers in ${scope} yet — add some from Discover to get scoped analysis.`;

  const topics = [...new Set(papers.flatMap((p) => p.tags))].slice(0, 6);
  const years = papers.map((p) => p.year);
  const span = `${Math.min(...years)}–${Math.max(...years)}`;

  if (q.includes("tabl") || q.includes("matrix") || q.includes("grid")) {
    const rows = papers.slice(0, 6).map((p, i) => {
      const author = p.authors[0] ?? "Anon";
      const tag = p.tags[0] ?? "General";
      return `| [${i + 1}] ${p.title.slice(0, 32)}… | ${author} (${p.year}) | ${tag} | ${p.citations.toLocaleString()} |`;
    }).join("\n");

    return `## Tabular Analysis — ${scope}
Analyzed ${papers.length} papers across ${span}.

| Paper Title | Primary Author | Focus Domain | Citations |
| --- | --- | --- | --- |
${rows}

### Key Observations
- **Top Cited Focus:** Clustered around ${topics.slice(0, 3).join(", ") || "Machine Learning"}.
- **Methodology Span:** Covers empirical benchmarks from ${span}.

### Corpus Analyzed
${paperList(papers)}`;
  }

  if (q.includes("gap") || q.includes("missing") || q.includes("under")) {
    return `## Research gaps — ${scope}
Analyzed ${papers.length} papers (${span}).

**1. Multilingual & non-English coverage.** Every evaluation in this set is English-only; none report cross-lingual transfer.

**2. Retraction & provenance signals.** No method in scope integrates retraction status or version history into retrieval or synthesis.

**3. Long-horizon evaluation.** Benchmarks are single-turn. No multi-session study measures drift over a sustained literature review.

**4. Cost-normalized comparison.** Gains are reported without token/compute normalization, so agentic wins may be budget artifacts.

### Corpus analyzed
${paperList(papers)}`;
  }

  if (q.includes("literature review") || q.includes("related work") || q.includes("draft")) {
    return `## Literature review — ${scope}

### Scope
${papers.length} papers spanning ${span}, clustered around ${topics.join(", ")}.

### Narrative
Recent work converges on hybrid pipelines that pair dense passage retrieval with citation-topology signals [1, 3]. Building on domain-tuned scientific embeddings [${Math.min(5, papers.length)}], agentic systems orchestrate retrieval, extraction, and verification stages to reduce hallucination in long-form synthesis [1, 2]. A second thread reranks candidates using citation-graph proximity, which outperforms pure embedding similarity on well-connected literatures but degrades on cold-start pre-prints.

Despite consistent gains of 8–14 F1 on SciFact-style benchmarks, evaluation remains English-centric, retraction-agnostic, and single-turn — limiting claims about real reviewing workflows.

### References
${paperList(papers, 10)}`;
  }

  if (q.includes("compare") || q.includes("method")) {
    return `## Methodology comparison — ${scope}

| Approach | Papers | Reported gain | Cost |
| --- | --- | --- | --- |
| Dense retrieval + rerank | ${Math.ceil(papers.length * 0.55)} | +6–9 F1 | 1× |
| Graph-augmented retrieval | ${Math.ceil(papers.length * 0.25)} | +8–11 F1 | 1.8× |
| Agentic / multi-step | ${Math.max(1, Math.floor(papers.length * 0.2))} | +12–14 F1 | 4–6× |

Agentic approaches report the largest gains but at 4–6× the token cost; none of the papers normalize for that budget.`;
  }

  if (q.includes("contradict") || q.includes("conflict")) {
    return `## Contradictions — ${scope}

**A. Critic verification.** One line of work claims a 34% hallucination reduction from critic verification; another finds the same architecture fabricates 11–18% of atomic claims on physics summaries.

**B. Graph vs. embedding.** Citation-graph proximity is argued to dominate embedding similarity — but the opposite holds on cold-start pre-prints with sparse citations.

**C. Chunk size.** Reported optimum ranges from 256 to 1024 tokens across the set, with no shared evaluation protocol.`;
  }

  if (q.includes("summar")) {
    return `## Summary — ${scope}

${papers.length} papers, ${span}. Core themes: ${topics.join(", ")}.

- **(a)** Dense embeddings tuned for scientific text.
- **(b)** Citation-graph reranking.
- **(c)** Agentic verification loops.

**Consensus:** hybrid pipelines outperform either component alone by 8–14 F1 on SciFact-style benchmarks.

### Papers
${paperList(papers)}`;
  }

  return `Working across ${papers.length} papers in ${scope} (${span}). The consensus points toward retrieval-augmented, critic-verified pipelines.

Try: **find research gaps**, **write literature review**, **summarize corpus**, **compare methodologies**, or **find contradictions**.`;
}
