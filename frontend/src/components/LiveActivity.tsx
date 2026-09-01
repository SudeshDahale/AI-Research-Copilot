import { useEffect, useState } from "react";
import { Activity, Database, Network, Sparkle, ShieldCheck } from "lucide-react";
import { SAMPLE_ACTIVITY, type ActivityEvent } from "@/lib/mock-data";

const ICONS = {
  index: Database,
  retrieve: Network,
  summarize: Sparkle,
  graph: Activity,
  critic: ShieldCheck,
} as const;

const POOL: Omit<ActivityEvent, "id" | "ts">[] = [
  { kind: "retrieve", message: "Dense retrieval · 187ms · top-50 candidates" },
  { kind: "critic", message: "Verified 32/33 atomic claims" },
  { kind: "summarize", message: "Structured summary drafted · 5 sections" },
  { kind: "graph", message: "Expanded neighborhood · +214 related papers" },
  { kind: "index", message: "Ingested 384 new pre-prints (arXiv, bioRxiv)" },
  { kind: "retrieve", message: "Reranked with citation-graph PPR · nDCG 0.91" },
  { kind: "critic", message: "Retraction-watch scan · 0 flags" },
];

export function LiveActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>(SAMPLE_ACTIVITY);

  useEffect(() => {
    const t = setInterval(() => {
      const next = POOL[Math.floor(Math.random() * POOL.length)];
      setEvents((prev) =>
        [
          { ...next, id: crypto.randomUUID(), ts: "just now" },
          ...prev.map((e, i) => ({ ...e, ts: i === 0 ? "8s" : e.ts })),
        ].slice(0, 6),
      );
    }, 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Live agent activity
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">v2.4.1</span>
      </div>
      <ul className="space-y-2">
        {events.map((e) => {
          const Icon = ICONS[e.kind];
          return (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm"
            >
              <Icon className="mt-0.5 h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-foreground/90">{e.message}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {e.kind} · {e.ts}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
