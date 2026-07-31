import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Sparkles, ChevronRight, Check } from "lucide-react";
import { MOCK_PAPERS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { StreamingText } from "@/components/StreamingText";

export const Route = createFileRoute("/_app/review")({
  head: () => ({
    meta: [
      { title: "Literature Review · Arclight" },
      { name: "description", content: "Autonomously drafted literature review." },
      { property: "og:title", content: "Literature Review · Arclight" },
      { property: "og:description", content: "Autonomously drafted literature review." },
    ],
  }),
  component: ReviewPage,
});

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Introduction",
    body: "The rapid growth of large language models has catalyzed a new class of scientific tooling that automates the literature review process. This draft synthesizes recent work on retrieval-augmented reasoning, autonomous agents, and evaluation of factual grounding across scientific summarization systems.",
  },
  {
    title: "Retrieval-Augmented Reasoning",
    body: "Okafor et al. (2025) introduce RARS, a two-stage pipeline combining dense passage retrieval with claim-level verification that reduces factual hallucinations by 34% over baselines. Tanaka et al. (2023) show that fusing citation-graph proximity with embedding similarity yields consistent gains across SciDocs and TREC-COVID.",
  },
  {
    title: "Autonomous Agents",
    body: "Balaji and Nguyen (2024) demonstrate that a planner-retriever-drafter architecture can produce reviews approaching PhD-level quality on a 5-point rubric, at a cost of roughly $4.20 per document. Their approach remains limited on niche subfields.",
  },
  {
    title: "Evaluation",
    body: "Weiss and Park (2025) benchmark hallucination rates and find that frontier LLMs still fabricate 11–18% of atomic claims in long-form outputs, with no automated proxy metric exceeding 0.6 correlation with expert judgement.",
  },
  {
    title: "Research Gaps",
    body: "Three under-explored directions emerge: multilingual retrieval and synthesis, integration of retraction and peer-review signals into critic modules, and temporal reasoning across longitudinal paper timelines.",
  },
];

function ReviewPage() {
  const [stage, setStage] = useState<"planning" | "drafting" | "ready">("planning");
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStage("drafting"), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (revealed >= SECTIONS.length && stage === "drafting") setStage("ready");
  }, [revealed, stage]);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_240px]">
      <article className="min-w-0">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          {stage !== "ready" ? (
            <>
              <span className="live-dot" />
              <span>Drafting from {MOCK_PAPERS.slice(0, 6).length} sources…</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-live" />
              <span>Draft ready · 4,812 tokens · APA</span>
            </>
          )}
        </div>

        <h1 className="font-display text-5xl leading-tight">
          Hallucination-aware AI for scientific synthesis
        </h1>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" disabled={stage !== "ready"}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" disabled={stage !== "ready"}>Word</Button>
          <Button size="sm" variant="outline" disabled={stage !== "ready"}>BibTeX</Button>
        </div>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s, idx) => {
            const visible = idx <= revealed;
            const streaming = idx === revealed && stage === "drafting";
            return (
              <section key={s.title} className={`transition-opacity ${visible ? "opacity-100" : "opacity-30"}`}>
                <h2 className="font-display text-2xl">{s.title}</h2>
                <div className="mt-3 max-w-prose">
                  {visible ? (
                    streaming ? (
                      <StreamingText
                        text={s.body}
                        speed={8}
                        className="text-base leading-relaxed text-foreground/85"
                        onDone={() => setRevealed((v) => v + 1)}
                      />
                    ) : (
                      <p className="text-base leading-relaxed text-foreground/85">{s.body}</p>
                    )
                  ) : (
                    <p className="text-sm italic text-muted-foreground">Queued…</p>
                  )}
                </div>
              </section>
            );
          })}

          <section className="border-t border-border pt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">References</h3>
            <ol className="mt-3 space-y-2 text-sm">
              {MOCK_PAPERS.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex gap-3 text-foreground/85">
                  <span className="text-muted-foreground tabular-nums">[{i + 1}]</span>
                  <span>
                    {p.authors.join(", ")}. <em>{p.title}</em>. {p.journal}, {p.year}.
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </article>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Progress
          </div>
          <ol className="space-y-1.5 text-sm">
            {SECTIONS.map((s, i) => {
              const done = i < revealed || stage === "ready";
              const active = i === revealed && stage === "drafting";
              return (
                <li key={s.title} className="flex items-center gap-2">
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-live" />
                  ) : active ? (
                    <span className="live-dot" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                  <span className={done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground/70"}>
                    {s.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
