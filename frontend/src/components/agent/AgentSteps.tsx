import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Circle } from "lucide-react";
import type { PlanStep } from "@/lib/agent-plan";

/**
 * Claude/Lovable-style live task list: steps tick over one by one in place.
 * When `collapsedSummary` is set the list renders as a finished, collapsible trace.
 */
export function AgentSteps({
  steps,
  onDone,
  collapsedSummary = false,
  size = "sm",
  liveIndex,
}: {
  steps: PlanStep[];
  onDone?: () => void;
  collapsedSummary?: boolean;
  size?: "sm" | "lg";
  /** Sprint 7: when provided, progress is driven by real backend events
   *  instead of the internal per-step timer. The parent increments this
   *  as each SSE "step" event arrives. */
  liveIndex?: number;
}) {
  const live = liveIndex !== undefined;
  const [internalIdx, setInternalIdx] = useState(collapsedSummary ? steps.length : 0);
  const idx = live ? liveIndex : internalIdx;
  const [open, setOpen] = useState(!collapsedSummary);

  useEffect(() => {
    if (collapsedSummary || live) return;
    if (internalIdx >= steps.length) {
      const t = setTimeout(() => onDone?.(), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setInternalIdx((i) => i + 1), steps[internalIdx].ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalIdx, steps, collapsedSummary, live]);

  const done = idx >= steps.length;
  const lg = size === "lg";

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur ${
        collapsedSummary ? "mb-2" : "card-3d"
      }`}
    >
      <button
        type="button"
        onClick={() => collapsedSummary && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 ${lg ? "py-3" : "py-2"} text-left`}
      >
        {done ? (
          <Check className="h-3.5 w-3.5 text-[color:var(--live)]" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        )}
        <span
          className={`flex-1 font-medium ${lg ? "text-sm" : "text-[11px]"} ${
            done ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {done ? `Completed ${steps.length} steps` : (steps[idx]?.label ?? "Working") + "…"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {Math.min(idx + (done ? 0 : 1), steps.length)}/{steps.length}
        </span>
        {collapsedSummary && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <ol className="border-t border-border px-3 py-2">
          {steps.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "pending";
            if (collapsedSummary && state !== "done") return null;
            return (
              <li
                key={s.label}
                className={`relative flex items-start gap-2.5 py-1.5 pl-1 transition-opacity ${
                  state === "pending" ? "opacity-40" : "opacity-100"
                }`}
              >
                <span className="mt-[3px] shrink-0">
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5 text-[color:var(--live)]" />
                  ) : state === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block ${lg ? "text-[13px]" : "text-xs"} ${
                      state === "active" ? "font-medium text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`block ${lg ? "text-[11px]" : "text-[10px]"} text-muted-foreground`}
                  >
                    {state === "pending" ? "queued" : s.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
