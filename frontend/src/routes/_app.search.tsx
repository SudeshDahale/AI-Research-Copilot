import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Search as SearchIcon,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
  Check,
  FolderPlus,
  Plus,
} from "lucide-react";
import { MOCK_PAPERS } from "@/lib/mock-data";
import { rankPapers, type Ranked } from "@/lib/rank";
import { downloadText, slugify, stamp } from "@/lib/download";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AgentChat } from "@/components/agent/AgentChat";
import { AgentSteps } from "@/components/agent/AgentSteps";
import { searchSteps, workspaceSteps, answerSteps, type Artifact } from "@/lib/agent-plan";
import { buildAgentReply } from "@/lib/agent";
import { useWorkspaces, type Workspace } from "@/lib/workspaces";


export const Route = createFileRoute("/_app/search")({
  head: () => ({
    meta: [
      { title: "Discover · Arclight" },
      { name: "description", content: "Autonomous agentic search across millions of scientific papers." },
      { property: "og:title", content: "Discover · Arclight" },
      { property: "og:description", content: "Autonomous agentic search across millions of scientific papers." },
    ],
  }),
  component: SearchPage,
});

const SUGGESTIONS = [
  "hallucination in scientific LLMs",
  "retrieval-augmented reasoning",
  "citation graph neural networks",
  "autonomous literature review agents",
];

const ALL_TAGS = ["RAG", "LLM", "Retrieval", "Graph", "Evaluation", "Agents", "Embeddings", "Benchmark", "Multimodal", "Reasoning"];
const ALL_VENUES = ["NeurIPS", "ICML", "ICLR", "ACL", "EMNLP", "AAAI", "TACL", "Nature", "Science", "JMLR"];

function SearchPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // filters
  const [yearRange, setYearRange] = useState<[number, number]>([2019, 2026]);
  const [minCites, setMinCites] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [sort, setSort] = useState<"relevance" | "recent" | "cited">("relevance");

  const [searching, setSearching] = useState(false);
  const [runId, setRunId] = useState(0);


  // selection for workspace
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { workspaces, create, addPapers } = useWorkspaces();
  const [wsPickerOpen, setWsPickerOpen] = useState(false);

  const results = useMemo(() => {
    if (!active) return [];
    const filtered = MOCK_PAPERS.filter(
      (p) =>
        p.year >= yearRange[0] &&
        p.year <= yearRange[1] &&
        p.citations >= minCites &&
        (selectedTags.length === 0 || p.tags.some((t) => selectedTags.includes(t))) &&
        (selectedVenues.length === 0 || selectedVenues.includes(p.journal)),
    );
    const ranked = rankPapers(active, filtered).filter((p) => p.score > 0.14);
    if (sort === "recent") ranked.sort((a, b) => b.year - a.year);
    if (sort === "cited") ranked.sort((a, b) => b.citations - a.citations);
    return ranked;
  }, [active, yearRange, minCites, selectedTags, selectedVenues, sort]);


  useEffect(() => setSelected(new Set()), [active]);

  const runSearch = (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setActive(q);
    setSearching(true);
    setRunId((n) => n + 1);
  };

  // Agent task execution for the side chat — plans, runs steps, then acts.
  const execute = (text: string) => {
    const q = text.toLowerCase();
    const wantsWorkspace =
      q.includes("workspace") || q.includes("collection") || q.includes("save these");

    if (wantsWorkspace) {
      const picks = results.slice(0, 8);
      return {
        steps: workspaceSteps(active, results.length),
        finish: () => {
          const name = active.length > 42 ? `${active.slice(0, 42)}…` : active;
          const ws = create(name, picks.map((p) => p.id));
          const artifact: Artifact = {
            type: "workspace",
            id: ws.id,
            name: ws.name,
            count: ws.paperIds.length,
          };
          return {
            text: `Done — I created the workspace **${ws.name}** and scoped it to the ${picks.length} most relevant papers for "${active}".\n\n${picks
              .map((p, i) => `${i + 1}. **${p.title}** — ${p.journal} ${p.year} · ${Math.round(p.score * 100)}% match`)
              .join("\n")}\n\nOpen it to run deeper, scoped analysis or generate documents.`,
            artifact,
          };
        },
      };
    }

    return {
      steps: answerSteps(Math.min(results.length, 40)),
      finish: () => ({ text: buildAgentReply(text, results.slice(0, 40), `"${active}"`) }),
    };
  };


  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const addSelectedTo = (ws: Workspace) => {
    addPapers(ws.id, [...selected]);
    setSelected(new Set());
    setWsPickerOpen(false);
  };

  const createWorkspaceFromSelection = () => {
    const name = prompt("Name this workspace:", active);
    if (!name) return;
    const ws = create(name, [...selected]);
    setSelected(new Set());
    setWsPickerOpen(false);
    alert(`Workspace "${ws.name}" created with ${ws.paperIds.length} papers. Open it in Workflow.`);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      {/* Search bar */}
      <div className={active ? "mb-4" : "mx-auto mt-16 max-w-2xl"}>
        {!active && (
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <span className="live-dot" /> Agentic research assistant · live
            </div>
            <h1 className="font-display text-5xl leading-tight">What are you researching?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Type your topic below. Arclight ranks the most similar papers, you pick the ones that matter,
              and the agent works only on those.
            </p>
            <ol className="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-3">
              {[
                ["1", "Search your topic", "Ranked by similarity"],
                ["2", "Select + save", "Build a workspace"],
                ["3", "Ask the agent", "Gaps, review, export"],
              ].map(([n, t, d]) => (
                <li
                  key={n}
                  className="card-3d rounded-lg border border-border bg-card/80 px-3 py-2.5 backdrop-blur"
                >
                  <div className="mb-0.5 font-mono text-[10px] text-accent">STEP {n}</div>
                  <div className="text-[13px] font-medium">{t}</div>
                  <div className="text-[11px] text-muted-foreground">{d}</div>
                </li>
              ))}
            </ol>
          </div>
        )}



        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. reducing hallucinations in scientific LLMs with retrieval"
              className="h-12 bg-card pl-9 text-base shadow-md"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="btn-pop h-12 px-5 shadow-md">
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Search <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
          {active && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="btn-pop h-12"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          )}
        </form>

        {!active && (
          <div className="mt-6">
            <div className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Try
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => runSearch(s)}
                  className="btn-pop rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-sm hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {active && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
          {/* Filters */}
          {showFilters && (
            <aside className="card-3d rounded-xl border border-border bg-card p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Filters
                </span>
                <button
                  onClick={() => {
                    setYearRange([2019, 2026]);
                    setMinCites(0);
                    setSelectedTags([]);
                    setSelectedVenues([]);
                    setSort("relevance");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              </div>

              <FilterBlock label="Sort by">
                <div className="flex gap-1">
                  {(["relevance", "recent", "cited"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`btn-pop flex-1 rounded-md border px-2 py-1 text-xs capitalize transition-colors ${
                        sort === s
                          ? "border-accent bg-accent text-accent-foreground shadow-sm"
                          : "border-border bg-background hover:border-foreground/30"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </FilterBlock>

              <FilterBlock label={`Year: ${yearRange[0]}–${yearRange[1]}`}>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={yearRange[0]}
                    onChange={(e) => setYearRange([Number(e.target.value), yearRange[1]])}
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    value={yearRange[1]}
                    onChange={(e) => setYearRange([yearRange[0], Number(e.target.value)])}
                    className="h-8 text-xs"
                  />
                </div>
              </FilterBlock>

              <FilterBlock label={`Min citations: ${minCites}`}>
                <input
                  type="range"
                  min={0}
                  max={1500}
                  step={50}
                  value={minCites}
                  onChange={(e) => setMinCites(Number(e.target.value))}
                  className="w-full accent-[color:var(--accent)]"
                />
              </FilterBlock>

              <FilterBlock label="Topics">
                <div className="flex flex-wrap gap-1">
                  {ALL_TAGS.map((t) => {
                    const on = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedTags((a) => toggle(a, t))}
                        className={`btn-pop rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          on
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </FilterBlock>

              <FilterBlock label="Venues">
                <div className="space-y-1">
                  {ALL_VENUES.slice(0, 8).map((v) => {
                    const on = selectedVenues.includes(v);
                    return (
                      <label
                        key={v}
                        className="flex cursor-pointer items-center gap-2 text-xs text-foreground/80"
                        onClick={() => setSelectedVenues((a) => toggle(a, v))}
                      >
                        <span
                          className={`grid h-4 w-4 place-items-center rounded border transition-colors ${
                            on ? "border-accent bg-accent" : "border-border bg-background"
                          }`}
                        >
                          {on && <Check className="h-3 w-3 text-accent-foreground" />}
                        </span>
                        <span>{v}</span>
                      </label>
                    );
                  })}
                </div>
              </FilterBlock>
            </aside>
          )}

          {/* Results — with the agent's live plan running in the centre */}
          <section className={showFilters ? "" : "lg:col-start-1 lg:col-end-3"}>
            {searching ? (
              <div className="flex min-h-[62vh] items-center justify-center px-2">
                <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
                  <div className="mb-4 text-center">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                      <span className="live-dot" /> Agent working
                    </div>
                    <h2 className="font-display text-2xl leading-snug">Researching “{active}”</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Executing the retrieval plan step by step.
                    </p>
                  </div>
                  <AgentSteps
                    key={runId}
                    steps={searchSteps(active, results.length)}
                    size="lg"
                    onDone={() => setSearching(false)}
                  />
                </div>
              </div>
            ) : (
              <>
            {!searching && (

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{results.length.toLocaleString()}</span>{" "}
                  papers ranked by similarity to <span className="text-foreground">"{active}"</span>
                  {selected.size === 0 && results.length > 0 && (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                      Tick the papers you want → add to a workspace
                    </span>
                  )}
                </span>
                <button
                  onClick={() =>
                    downloadText(
                      `${slugify(active)}-results-${stamp()}.md`,
                      `# Ranked results — "${active}"\n\n_${results.length} papers · exported ${stamp()}_\n\n` +
                        results
                          .slice(0, 40)
                          .map(
                            (p, i) =>
                              `${i + 1}. **${p.title}** — ${p.authors.join(", ")}. *${p.journal}* (${p.year}). ${p.citations} citations. Match ${Math.round(p.score * 100)}%.`,
                          )
                          .join("\n"),
                    )
                  }
                  className="btn-pop rounded-md border border-border bg-card px-2 py-1 hover:border-accent hover:text-accent"
                >
                  Export list
                </button>
              </div>
            )}


            {/* CTA — bulk workspace */}
            {selected.size > 0 && (
              <div className="card-3d mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1">
                <span>
                  <span className="font-medium text-foreground">{selected.size}</span> papers selected — scope the agent to just these:
                </span>
                <div className="relative flex items-center gap-2">
                  <Button
                    size="sm"
                    className="btn-pop h-8 gap-1"
                    onClick={() => setWsPickerOpen((v) => !v)}
                  >
                    <FolderPlus className="h-3.5 w-3.5" /> Add to workspace
                  </Button>
                  <Button size="sm" variant="ghost" className="btn-pop h-8" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>

                  {wsPickerOpen && (
                    <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-border bg-popover p-2 shadow-xl animate-in fade-in zoom-in-95">
                      <button
                        onClick={createWorkspaceFromSelection}
                        className="btn-pop flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create new workspace…
                      </button>
                      {workspaces.length > 0 && (
                        <>
                          <div className="mt-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Existing
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {workspaces.map((w) => (
                              <button
                                key={w.id}
                                onClick={() => addSelectedTo(w)}
                                className="btn-pop flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                              >
                                <span className="truncate">{w.name}</span>
                                <span className="text-[10px] text-muted-foreground">{w.paperIds.length}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <ul className="mt-3 card-3d overflow-hidden rounded-xl border border-border bg-card">
              {results.slice(0, 40).map((p, i) => (
                <ResultRow
                  key={p.id}
                  paper={p}
                  rank={i + 1}
                  checked={selected.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                />
              ))}
            </ul>
              </>
            )}
          </section>

          {/* Chatbot */}
          <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <AgentChat
              key={active}
              papers={results.slice(0, 40)}
              scope={`"${active}"`}
              title="Research Agent"
              subtitle={`Analyzing ${Math.min(results.length, 40)} papers · general scope`}
              seedMessage={`I've pulled the top papers for "${active}". Ask me to run tasks — e.g. **"find the papers relevant to my topic and create a workspace"** — and I'll execute them for you.`}
              suggestions={[
                "Find relevant papers and create a workspace",
                "Summarize corpus",
                "Find research gaps",
                "Compare methodologies",
              ]}
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
      )}
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[11px] font-medium text-foreground/80">{label}</div>
      {children}
    </div>
  );
}


function ResultRow({
  paper,
  rank,
  checked,
  onToggle,
}: {
  paper: Ranked;
  rank: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const pct = Math.round(paper.score * 100);
  return (
    <li className="group border-b border-border last:border-b-0 hover:bg-muted/40">
      <div className="grid grid-cols-[24px_32px_1fr_auto] items-start gap-3 px-4 py-3.5">
        <label className="pt-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
          />
        </label>
        <div className="pt-0.5 text-right font-mono text-[11px] text-muted-foreground">
          {String(rank).padStart(2, "0")}
        </div>
        <Link to="/papers/$id" params={{ id: paper.id }} className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="text-foreground/70">{paper.journal}</span>
            <span>·</span>
            <span>{paper.year}</span>
            <span>·</span>
            <span>{paper.citations.toLocaleString()} cites</span>
            {paper.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background px-1.5 py-0 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
          <h3 className="text-[15px] font-medium leading-snug text-foreground group-hover:text-accent">
            {paper.title}
          </h3>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {paper.authors.join(", ")}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{paper.abstract}</p>
        </Link>
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-accent">
            {pct}%
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            match
          </div>
        </div>
      </div>
    </li>
  );
}
