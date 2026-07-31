import { useEffect, useState } from "react";
import { Database, Network, Activity, Sparkles, ShieldCheck, Check, Loader2 } from "lucide-react";
import { StreamingText } from "@/components/StreamingText";

const STAGES = [
  { key: "index", label: "Scanning corpus", detail: "81.4M papers · arXiv, bioRxiv, S2ORC", icon: Database, ms: 550 },
  { key: "retrieve", label: "Dense retrieval", detail: "SPECTER2 embeddings · top-500", icon: Network, ms: 650 },
  { key: "graph", label: "Citation graph", detail: "PageRank · +214 neighbors", icon: Activity, ms: 550 },
  { key: "rank", label: "Reranking with critic", detail: "Cross-encoder · nDCG 0.91", icon: Sparkles, ms: 600 },
  { key: "verify", label: "Verifying claims", detail: "Retraction-watch · 0 flags", icon: ShieldCheck, ms: 500 },
];

export function useSearchPipeline(trigger: unknown) {
  const [idx, setIdx] = useState(-1);
  useEffect(() => {
    if (trigger === null || trigger === undefined || trigger === "") return;
    setIdx(0);
  }, [trigger]);
  useEffect(() => {
    if (idx < 0 || idx >= STAGES.length) return;
    const t = setTimeout(() => setIdx((i) => i + 1), STAGES[idx].ms);
    return () => clearTimeout(t);
  }, [idx]);
  return { idx, running: idx >= 0 && idx < STAGES.length, done: idx >= STAGES.length };
}

export function LivePipeline({ stageIdx, results, tone = "search" }: { stageIdx: number; results: number; tone?: "search" | "workspace" }) {
  const done = stageIdx >= STAGES.length;
  const label = tone === "workspace" ? "Workspace agent" : "Autonomous agent";
  return (
    <div className="card-3d overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {done ? "Search complete" : `${label} running`}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {done ? `${results} results` : `stage ${Math.min(stageIdx + 1, STAGES.length)}/${STAGES.length}`}
        </span>
      </div>
      <ol className="grid grid-cols-1 divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
        {STAGES.map((s, i) => {
          const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "pending";
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex items-start gap-2.5 px-3 py-2.5">
              <div
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all ${
                  state === "done"
                    ? "border-[color:var(--live)] bg-[color:var(--live)]/10 text-[color:var(--live)]"
                    : state === "active"
                      ? "border-accent bg-accent/10 text-accent scale-110"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : state === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-foreground">{s.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {state === "pending" ? "queued" : s.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {done && (
        <div className="border-t border-border bg-secondary/40 px-4 py-2 text-[11px] text-muted-foreground">
          <StreamingText text={`Synthesized ${results} papers in 2.31s. Ready.`} speed={14} />
        </div>
      )}
    </div>
  );
}
