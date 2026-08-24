import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  ArrowUpDown,
  MoreHorizontal,
  BookOpen,
  CheckCircle2,
  Circle,
  FolderPlus,
  ArrowRight,
} from "lucide-react";
import { MOCK_PAPERS, type Paper } from "@/lib/mock-data";
import { getCachedPapers } from "@/lib/paper-cache";
import { apiStream } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AgentChat, type StreamCallbacks } from "@/components/agent/AgentChat";
import { workspaceSteps, type Artifact } from "@/lib/agent-plan";
import { useWorkspaces } from "@/lib/workspaces";

export const Route = createFileRoute("/_app/library")({
  head: () => ({
    meta: [
      { title: "Library · Arclight" },
      { name: "description", content: "Your saved papers with a live research agent alongside." },
      { property: "og:title", content: "Library · Arclight" },
      { property: "og:description", content: "Saved papers, searchable, with a scoped research agent." },
    ],
  }),
  component: LibraryPage,
});

type SortKey = "relevance" | "year" | "citations" | "added";
type StatusFilter = "all" | "unread" | "reading" | "read";

function LibraryPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { workspaces, create } = useWorkspaces();

  // Aggregate papers from all user workspaces and local paper cache
  const libraryPapers = useMemo(() => {
    const allWsPaperIds = Array.from(new Set(workspaces.flatMap((w) => w.paperIds || [])));
    const wsPapers = getCachedPapers(allWsPaperIds);

    let cachedMap: Record<string, Paper> = {};
    try {
      const stored = localStorage.getItem("arclight-paper-cache");
      if (stored) cachedMap = JSON.parse(stored);
    } catch {}

    const map = new Map<string, Paper>();
    // Baseline seed papers
    for (const p of MOCK_PAPERS) map.set(p.id, p);
    // Cached papers from searches
    for (const p of Object.values(cachedMap)) map.set(p.id, p);
    // Workspace-curated papers take highest priority
    for (const p of wsPapers) map.set(p.id, p);

    return Array.from(map.values());
  }, [workspaces]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    let rows = libraryPapers.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        (p.authors || []).some((a) => a.toLowerCase().includes(needle)) ||
        (p.journal || "").toLowerCase().includes(needle) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(needle))
      );
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "year": return (b.year || 0) - (a.year || 0);
        case "citations": return (b.citations || 0) - (a.citations || 0);
        case "relevance": return (b.relevance || 0) - (a.relevance || 0);
        default: return 0;
      }
    });
    return rows;
  }, [libraryPapers, q, status, sort]);

  const counts = useMemo(() => ({
    all: libraryPapers.length,
    unread: libraryPapers.filter((p) => (p.status || "unread") === "unread").length,
    reading: libraryPapers.filter((p) => p.status === "reading").length,
    read: libraryPapers.filter((p) => p.status === "read").length,
  }), [libraryPapers]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const createWorkspaceFromSelection = () => {
    if (selected.size === 0) return;
    const name = prompt("Name this workspace:", `Library selection · ${new Date().toLocaleDateString()}`);
    if (!name) return;
    const selectedPapers = filtered.filter((p) => selected.has(p.id));
    create(name, [...selected], selectedPapers);
    setSelected(new Set());
    alert(`Workspace "${name}" created with ${selected.size} papers. Open it from Workflow.`);
  };

  // Real live streaming LangGraph agent execution for Library chat
  const execute = (
    text: string,
    toolId: string | null,
    onProgress: (index: number) => void,
    callbacks?: StreamCallbacks,
  ) => {
    const q = text.toLowerCase().trim();
    const wantsWorkspace =
      q.includes("workspace") ||
      q.includes("collection") ||
      q.includes("save these") ||
      q.includes("create") ||
      q.includes("add to workspace");

    const numWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    const countDigitMatch = q.match(/\b(\d+)\s*(?:papers?|results?|items?)?\b/i) || q.match(/\b(?:top|first)\s*(\d+)\b/i);
    const countWordMatch = q.match(/\b(?:first\s+|top\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+papers?\b/i);
    let requestedCount: number | null = null;
    if (countDigitMatch) requestedCount = parseInt(countDigitMatch[1], 10);
    else if (countWordMatch) requestedCount = numWords[countWordMatch[1].toLowerCase()];

    if (wantsWorkspace) {
      const targetCount = requestedCount && requestedCount > 0 ? requestedCount : (selected.size > 0 ? selected.size : 5);
      let picks = scopedPapers.slice(0, targetCount);
      if (selected.size > 0) {
        const selectedList = scopedPapers.filter((p) => selected.has(p.id));
        if (selectedList.length > 0) {
          picks = selectedList.slice(0, targetCount);
        }
      }
      const steps = workspaceSteps("Library", picks.length);
      return {
        steps,
        finish: async () => {
          onProgress(1);
          let wsName = `Library Selection · ${new Date().toLocaleDateString()}`;
          const nameMatch = text.match(/(?:named|called|for|on)\s+["']?([^"'\n,]+)["']?/i);
          if (nameMatch && nameMatch[1].trim().length > 2 && !nameMatch[1].toLowerCase().includes("paper")) {
            wsName = nameMatch[1].trim();
          }
          if (wsName.length > 42) wsName = `${wsName.slice(0, 42)}…`;

          const ws = await create(wsName, picks.map((p) => p.id), picks);
          onProgress(steps.length);
          const artifact: Artifact = {
            type: "workspace",
            id: ws.id,
            name: ws.name,
            count: ws.paperIds.length,
          };
          return {
            text: `Done — I created the workspace **${ws.name}** with ${picks.length} papers from your library:\n\n${picks
              .map((p, i) => `${i + 1}. **${p.title}** — ${p.journal || "ArXiv"} ${p.year}`)
              .join("\n")}\n\nOpen it in Workflow to run deeper analysis or generate documents.`,
            artifact,
          };
        },
        live: true,
      };
    }

    const steps = [
      { label: "Analyzing library corpus", detail: `${scopedPapers.length} papers`, ms: 0 },
      { label: "Fast synthesis", detail: "Streaming live tokens", ms: 0 },
      { label: "Deep reasoning", detail: "Multi-stage research synthesis", ms: 0 },
    ];

    const runAgent = (): Promise<{ text: string; artifact?: Artifact }> =>
      new Promise((resolve, reject) => {
        let finalText = "";
        apiStream("/agent/run", { query: `${text} (Scope: user library collection)`, workspace_id: null }, (event, data) => {
          if (event === "thinking" || event === "retrieving") {
            onProgress(1);
          } else if (event === "token") {
            onProgress(2);
            callbacks?.onToken?.(data.chunk ?? "");
          } else if (event === "fast_completed") {
            onProgress(2);
            callbacks?.onFastCompleted?.(data.text ?? "");
          } else if (event === "refining") {
            onProgress(2);
            callbacks?.onRefining?.(data.message ?? "");
          } else if (event === "refined_completed") {
            finalText = data.text ?? "";
            onProgress(3);
            callbacks?.onRefinedCompleted?.(finalText);
          } else if (event === "completed") {
            if (!finalText) finalText = data.text ?? "";
            onProgress(3);
            resolve({ text: finalText });
          } else if (event === "error") {
            reject(new Error(data.message ?? "Agent execution failed"));
          }
        }).catch((err) => {
          console.error("Live agent stream failed:", err);
          reject(err);
        });
      });

    return { steps, finish: runAgent, live: true };
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.all.toLocaleString()} papers · autosaved · agent alongside
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/workflow">
            <Button variant="outline" size="sm" className="btn-pop">Workspaces</Button>
          </Link>
          <Link to="/search">
            <Button size="sm" className="btn-pop"><Plus className="mr-1 h-4 w-4" /> Add papers</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="card-3d sticky top-4 z-10 mb-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, author, journal, tag…"
                  className="h-9 border-0 bg-background pl-9"
                />
              </div>

              <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
                {(["all", "unread", "reading", "read"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`btn-pop rounded-sm px-2.5 py-1 capitalize transition-colors ${
                      status === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s} <span className="opacity-60">{counts[s]}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="cursor-pointer rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="added">Recently added</option>
                  <option value="relevance">Relevance</option>
                  <option value="year">Year</option>
                  <option value="citations">Citations</option>
                </select>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-primary/5 px-3 py-1.5 text-xs animate-in fade-in slide-in-from-top-1">
                <span>{selected.size} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" className="btn-pop h-7 gap-1" onClick={createWorkspaceFromSelection}>
                    <FolderPlus className="h-3.5 w-3.5" /> New workspace
                  </Button>
                  <Button size="sm" variant="ghost" className="btn-pop h-7" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="card-3d overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-[24px_1fr_120px_60px_80px_28px] items-center gap-4 border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span></span>
              <span>Paper</span>
              <span className="hidden md:block">Venue</span>
              <span className="hidden md:block text-right">Year</span>
              <span className="text-right">Cites</span>
              <span></span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No papers match.{" "}
                <button onClick={() => { setQ(""); setStatus("all"); }} className="text-accent underline">
                  Reset filters
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.slice(0, 200).map((p) => (
                  <Row key={p.id} paper={p} checked={selected.has(p.id)} onToggle={() => toggle(p.id)} />
                ))}
              </ul>
            )}

            {filtered.length > 200 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Showing 200 of {filtered.length.toLocaleString()}
              </div>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <AgentChat
            papers={scopedPapers}
            scope="your library"
            title="Library Agent"
            subtitle={`Reading ${scopedPapers.length} of ${counts.all} papers`}
            seedMessage={`I'm scoped to your library (${scopedPapers.length} papers). Ask about themes, gaps, or select papers and turn them into a workspace for deeper analysis.`}
            execute={execute}
            renderArtifact={(a) =>
              a.type === "workspace" ? (
                <Link to="/workflow/$id" params={{ id: a.id }}>
                  <div className="card-3d flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-xs hover:border-accent">
                    <FolderPlus className="h-4 w-4 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {a.count} papers · open workspace
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-accent" />
                  </div>
                </Link>
              ) : null
            }
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ paper, checked, onToggle }: { paper: Paper; checked: boolean; onToggle: () => void }) {
  const StatusIcon = paper.status === "read" ? CheckCircle2 : paper.status === "reading" ? BookOpen : Circle;
  const statusColor =
    paper.status === "read" ? "text-live" : paper.status === "reading" ? "text-accent" : "text-muted-foreground/60";

  return (
    <li className="group grid grid-cols-[24px_1fr_120px_60px_80px_28px] items-center gap-4 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <label className="flex cursor-pointer items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
        />
      </label>

      <Link to="/papers/$id" params={{ id: paper.id }} className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusColor}`} />
          <span className="truncate text-sm font-medium text-foreground group-hover:text-accent">
            {paper.title}
          </span>
        </div>
        <div className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
          {paper.authors.slice(0, 3).join(", ")}
          {paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ""}
          <span className="mx-1.5">·</span>
          {paper.addedAt}
        </div>
      </Link>

      <span className="hidden truncate text-xs text-muted-foreground md:block">{paper.journal}</span>
      <span className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">{paper.year}</span>
      <span className="text-right text-xs tabular-nums text-muted-foreground">{paper.citations.toLocaleString()}</span>

      <button
        className="btn-pop rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        onClick={(e) => e.preventDefault()}
        aria-label="More"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </li>
  );
}
