import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Search as SearchIcon,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
  Check,
  FolderPlus,
  FileText,
  BookOpen,
  History,
  Clock,
  X,
  Trash2,
  Plus,
  Copy,
  ExternalLink,
} from "lucide-react";
import { MOCK_PAPERS, type Paper } from "@/lib/mock-data";
import { type Ranked } from "@/lib/rank";
import { apiFetch, apiStream } from "@/lib/api";
import { downloadText, slugify, stamp, toBibTeX } from "@/lib/download";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AgentChat, type StreamCallbacks } from "@/components/agent/AgentChat";
import { AgentSteps } from "@/components/agent/AgentSteps";
import { searchSteps, workspaceSteps, answerSteps, type Artifact } from "@/lib/agent-plan";
import { useWorkspaces, type Workspace } from "@/lib/workspaces";
import { cachePapers } from "@/lib/paper-cache";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/search")({
  head: () => ({
    meta: [
      { title: "Discover · Arclight" },
      {
        name: "description",
        content: "Autonomous agentic search across millions of scientific papers.",
      },
      { property: "og:title", content: "Discover · Arclight" },
      {
        property: "og:description",
        content: "Autonomous agentic search across millions of scientific papers.",
      },
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

const ACADEMIC_FIELDS = [
  { id: "cs.AI", label: "AI (cs.AI)" },
  { id: "cs.CL", label: "NLP / Language (cs.CL)" },
  { id: "cs.CV", label: "Computer Vision (cs.CV)" },
  { id: "cs.LG", label: "Machine Learning (cs.LG)" },
  { id: "cs.SE", label: "Software Eng (cs.SE)" },
  { id: "cs.IR", label: "Info Retrieval (cs.IR)" },
  { id: "cs.HC", label: "HCI (cs.HC)" },
  { id: "stat.ML", label: "Stat ML (stat.ML)" },
  { id: "cs.DC", label: "Distributed (cs.DC)" },
  { id: "quant-ph", label: "Quantum (quant-ph)" },
];

const COMMON_TOPICS = [
  "LLM",
  "RAG",
  "Agent",
  "Reasoning",
  "Benchmark",
  "Evaluation",
  "Graph",
  "Embeddings",
  "Multimodal",
  "UML",
];

const SEARCH_HISTORY_KEY = "arclight-recent-searches";

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(history: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
  } catch (err) {
    console.warn("Failed to persist search history", err);
  }
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Search history state (Google/YouTube-style recent search suggestions)
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // filters
  const [yearRange, setYearRange] = useState<[number, number]>([2019, 2026]);
  const [minCites, setMinCites] = useState(0);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [sort, setSort] = useState<"relevance" | "recent" | "cited">("relevance");

  const [searching, setSearching] = useState(false);
  const [runId, setRunId] = useState(0);
  const [papers, setPapers] = useState<Ranked[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // selection for workspace
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const { workspaces, create, addPapers } = useWorkspaces();
  const { isGuest, openLoginModal } = useAuth();
  const [wsPickerOpen, setWsPickerOpen] = useState(false);

  // Dynamically extract real publication venues from retrieved results
  const availableVenues = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of papers) {
      if (
        p.journal &&
        p.journal.toLowerCase() !== "arxiv" &&
        p.journal.toLowerCase() !== "semantic scholar"
      ) {
        map.set(p.journal, (map.get(p.journal) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 8);
  }, [papers]);

  // Load search history and starred papers on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    try {
      const raw = localStorage.getItem("arclight-starred-papers");
      if (raw) setStarredIds(new Set(JSON.parse(raw)));
    } catch {
      // ignore
    }
  }, []);

  // Close history dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowHistoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // History management helpers
  const removeHistoryItem = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = searchHistory.filter((item) => item !== itemToRemove);
    setSearchHistory(next);
    saveSearchHistory(next);
  };

  const clearAllHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    saveSearchHistory([]);
    setShowHistoryDropdown(false);
  };

  const toggleStar = (paper: Ranked) => {
    const next = new Set(starredIds);
    if (next.has(paper.id)) {
      next.delete(paper.id);
    } else {
      next.add(paper.id);
      cachePapers([paper]);
    }
    setStarredIds(next);
    try {
      localStorage.setItem("arclight-starred-papers", JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  };

  const results = useMemo(() => {
    if (!active) return [];
    const filtered = papers.filter((p) => {
      if (p.year < yearRange[0] || p.year > yearRange[1]) return false;
      if (p.citations < minCites) return false;
      if (
        selectedFields.length > 0 &&
        !p.tags.some((t) => selectedFields.some((f) => t.toLowerCase().includes(f.toLowerCase())))
      ) {
        return false;
      }
      if (
        selectedTags.length > 0 &&
        !selectedTags.some(
          (tag) =>
            p.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())) ||
            p.title.toLowerCase().includes(tag.toLowerCase()) ||
            p.abstract.toLowerCase().includes(tag.toLowerCase()),
        )
      ) {
        return false;
      }
      if (selectedVenues.length > 0 && !selectedVenues.includes(p.journal)) {
        return false;
      }
      return true;
    });

    const ranked = [...filtered];
    if (sort === "relevance") ranked.sort((a, b) => b.score - a.score);
    if (sort === "recent") ranked.sort((a, b) => b.year - a.year);
    if (sort === "cited") ranked.sort((a, b) => b.citations - a.citations);
    return ranked;
  }, [active, papers, yearRange, minCites, selectedFields, selectedTags, selectedVenues, sort]);

  useEffect(() => setSelected(new Set()), [active]);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    const cleanQ = q.trim();
    setQuery(cleanQ);
    setActive(cleanQ);
    setShowHistoryDropdown(false);

    // Save search history (up to 5 items, deduplicated)
    setSearchHistory((prev) => {
      const next = [cleanQ, ...prev.filter((item) => item.toLowerCase() !== cleanQ.toLowerCase())].slice(0, 5);
      saveSearchHistory(next);
      return next;
    });

    setSearching(true);
    setPage(1);
    setHasMore(true);
    setRunId((n) => n + 1);

    try {
      const data = await apiFetch<(Paper & { relevance?: number; pdf_url?: string })[]>("/search", {
        method: "POST",
        body: JSON.stringify({ query: cleanQ, page: 1, limit: 30 }),
      });
      const mapped = data.map((p) => ({
        ...p,
        score: p.relevance ?? 0.0,
        pdfUrl: p.pdf_url,
      }));
      setPapers(mapped);
      cachePapers(mapped);
      if (data.length < 15) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setPapers([]);
      setHasMore(false);
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    if (!active || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await apiFetch<(Paper & { relevance?: number; pdf_url?: string })[]>("/search", {
        method: "POST",
        body: JSON.stringify({ query: active, page: nextPage, limit: 30 }),
      });
      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }
      const mapped = data.map((p) => ({
        ...p,
        score: p.relevance ?? 0.0,
        pdfUrl: p.pdf_url,
      }));
      setPapers((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const fresh = mapped.filter((p) => !existingIds.has(p.id));
        if (fresh.length === 0) setHasMore(false);
        const combined = [...prev, ...fresh];
        cachePapers(combined);
        return combined;
      });
      setPage(nextPage);
      if (data.length < 10) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Load more failed:", err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Agent task execution for the Discover chat — connects directly to live streaming LangGraph agent
  const execute = (
    text: string,
    toolId: string | null,
    onProgress: (index: number) => void,
    callbacks?: StreamCallbacks,
    history?: { role: "user" | "assistant"; content: string }[],
  ) => {
    const q = text.toLowerCase().trim();
    const wantsWorkspace =
      /\b(create|save|add|make|export|build)\b.*\b(work\s*space|workpasce|wrkspace|workspace|collection|folder)\b/i.test(q) ||
      /\b(save|add)\s+(these|all|selected|the\s+top\s*\d*)\s+papers?\s+(to|into|as)\b/i.test(q) ||
      q.includes("add to workspace") ||
      q.includes("save to workspace") ||
      q.includes("create workspace");

    const numWords: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    const countDigitMatch =
      q.match(/\b(\d+)\s*(?:papers?|results?|items?)?\b/i) || q.match(/\b(?:top|first)\s*(\d+)\b/i);
    const countWordMatch = q.match(
      /\b(?:first\s+|top\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+papers?\b/i,
    );
    let requestedCount: number | null = null;
    if (countDigitMatch) requestedCount = parseInt(countDigitMatch[1], 10);
    else if (countWordMatch) requestedCount = numWords[countWordMatch[1].toLowerCase()];

    if (isGuest) {
      if (wantsWorkspace) {
        openLoginModal({
          title: "Log in to create a workspace",
          message:
            "Guest mode allows paper searching. Sign in with shlok@mail.com to create workspaces and save collections.",
        });
        return {
          steps: [{ label: "Authentication required", detail: "Sign in required", ms: 0 }],
          finish: async () => ({
            text: "Creating workspaces requires a member login. Please sign in with **shlok@mail.com** (password: **test@123**) to save this workspace.",
          }),
          live: false,
        };
      }
      openLoginModal({
        title: "Log in to use AI Research Copilot",
        message:
          "Guest mode is restricted to paper searching to prevent extra token usage. Log in to chat with papers, perform deep reasoning, and generate synthesis.",
      });
      return {
        steps: [
          { label: "AI Copilot requires login", detail: "Token usage restricted to members", ms: 0 },
        ],
        finish: async () => ({
          text: "Guest mode allows paper searching and discovery. To prevent extra token usage, the AI Research Copilot and deep synthesis require logging in with a registered account (**shlok@mail.com**).",
        }),
        live: false,
      };
    }

    if (wantsWorkspace) {
      // 1. Check for explicit year constraints in the user's workspace prompt
      const yearMatch = q.match(/\b(201\d|202\d)\b/);
      const targetYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
      const isYearSpecific =
        targetYear &&
        (q.includes("year") ||
          q.includes("only") ||
          q.includes("from") ||
          q.includes("in") ||
          q.includes("of"));

      const sourceList = results.length > 0 ? results : papers;
      let eligible = sourceList;

      if (isYearSpecific && targetYear) {
        const matchingResults = sourceList.filter((p) => p.year === targetYear);
        if (matchingResults.length > 0) {
          eligible = matchingResults;
        } else {
          const matchingRaw = papers.filter((p) => p.year === targetYear);
          if (matchingRaw.length > 0) {
            eligible = matchingRaw;
          } else {
            eligible = [];
          }
        }
      }

      if (isYearSpecific && targetYear && eligible.length === 0) {
        const availableYears = Array.from(new Set(papers.map((p) => p.year))).sort((a, b) => b - a);
        const yearSpan =
          availableYears.length > 0
            ? `${availableYears[availableYears.length - 1]}–${availableYears[0]}`
            : "previous years";
        return {
          steps: [{ label: "Checking publication years", detail: `Year ${targetYear}`, ms: 0 }],
          finish: async () => {
            return {
              text: `None of the papers in the current search results for "${active || "your search"}" were published in **${targetYear}** (results span ${yearSpan}).\n\nWould you like me to:\n1. Create a workspace with the most recent papers (${availableYears[0] || "latest"}) instead?\n2. Run a new search specifically targeting "${active || "topic"} ${targetYear}"?`,
            };
          },
          live: true,
        };
      }

      const targetCount =
        requestedCount && requestedCount > 0
          ? requestedCount
          : selected.size > 0
            ? selected.size
            : eligible.length > 0
              ? Math.min(eligible.length, 5)
              : 5;

      let picks = eligible.slice(0, targetCount);
      if (selected.size > 0 && !isYearSpecific) {
        const selectedList = eligible.filter((p) => selected.has(p.id));
        if (selectedList.length > 0) {
          picks = selectedList.slice(0, targetCount);
        }
      }

      const steps = workspaceSteps(active || "Search", picks.length);
      return {
        steps,
        finish: async () => {
          onProgress(1);
          let wsName = active
            ? isYearSpecific && targetYear
              ? `${active} (${targetYear})`
              : `${active} Workspace`
            : "Curated Workspace";
          const nameMatch = text.match(/(?:named|called|for|on)\s+["']?([^"'\n,]+)["']?/i);
          if (
            nameMatch &&
            nameMatch[1].trim().length > 2 &&
            !nameMatch[1].toLowerCase().includes("paper") &&
            !nameMatch[1].toLowerCase().includes("workspace")
          ) {
            wsName = nameMatch[1].trim();
          }
          if (wsName.length > 42) wsName = `${wsName.slice(0, 42)}…`;

          const picksData = picks.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors || [],
            year: p.year || 0,
            journal: p.journal || "",
            citations: p.citations || 0,
            relevance: p.score || 0,
            abstract: p.abstract || "",
            tags: p.tags || [],
            doi: p.doi || "",
            addedAt: p.addedAt || "Just now",
            status: p.status || "unread",
            summary: p.summary || {},
            gaps: p.gaps || [],
            future: p.future || [],
            pdf_url: p.pdfUrl || null,
          }));

          const ws = await create(
            wsName,
            picks.map((p) => p.id),
            picksData,
          );
          onProgress(steps.length);
          const artifact: Artifact = {
            type: "workspace",
            id: ws.id,
            name: ws.name,
            count: ws.paperIds.length,
          };
          return {
            text: `Done — I created the workspace **${ws.name}** with ${picks.length} papers${isYearSpecific && targetYear ? ` published in **${targetYear}**` : ""} for "${active || wsName}":\n\n${picks
              .map(
                (p, i) =>
                  `${i + 1}. **${p.title}** — ${p.journal || "ArXiv"} ${p.year} (${Math.round((p.score || 0) * 100)}% match)`,
              )
              .join(
                "\n",
              )}\n\nOpen it in Workflow to run deeper, scoped analysis or generate documents.`,
            artifact,
          };
        },
        live: true,
      };
    }

    const isFilterOrTopN =
      /^(top\s*\d+|\d+\s+(best|most\s+relevant)|filter|only\s+20\d\d|show\s+top|show\s+20\d\d|papers\s+in\s+20\d\d|papers\s+from\s+20\d\d)/i.test(q) ||
      (/\b(filter|only|show)\b.*\b(201\d|202\d)\b/i.test(q) && !wantsWorkspace);

    if (isFilterOrTopN) {
      const steps = [
        { label: "Filtering candidates", detail: "Applying criteria", ms: 0 },
        { label: "Refining view", detail: "Updating results", ms: 0 },
      ];
      return {
        steps,
        finish: async () => {
          onProgress(1);
          const candidatePayload = results.slice(0, 50).map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors || [],
            year: p.year || 0,
            journal: p.journal || "",
            citations: p.citations || 0,
            relevance: p.score || 0,
            abstract: p.abstract || "",
            tags: p.tags || [],
            doi: p.doi || "",
            addedAt: p.addedAt || "Just now",
            status: p.status || "unread",
            summary: p.summary || {},
            gaps: p.gaps || [],
            future: p.future || [],
            pdf_url: p.pdfUrl || null,
          }));

          const res = await apiFetch<{
            reply: string;
            papers: (Paper & { relevance?: number; pdf_url?: string })[];
            action: string;
          }>("/discover/chat", {
            method: "POST",
            body: JSON.stringify({
              message: text,
              query: active,
              candidates: candidatePayload,
            }),
          });

          if ((res.action === "top_n" || res.action === "filter") && res.papers?.length) {
            const mapped = res.papers.map((p) => ({
              ...p,
              score: p.relevance ?? 0.0,
              pdfUrl: p.pdf_url,
            }));
            setPapers(mapped);
          }
          onProgress(2);

          let responseText = res.reply;
          if (res.papers && res.papers.length > 0) {
            const listPreview = res.papers
              .slice(0, 5)
              .map((p, i) => `${i + 1}. **${p.title}** — ${p.journal || "ArXiv"} ${p.year}`)
              .join("\n");
            responseText += `\n\n${listPreview}`;
            if (res.papers.length > 5) {
              responseText += `\n\n*(${res.papers.length - 5} additional papers in view)*`;
            }
          }
          return { text: responseText };
        },
        live: true,
      };
    }

    // Real live LangGraph dual-pipeline streaming agent for summary, gaps, compare, review, and generic research queries
    const activePapersList = results.length > 0 ? results : papers;
    const steps = [
      {
        label: "Analyzing in-scope papers",
        detail: active ? `Topic: ${active} (${activePapersList.length} papers)` : "Research agent synthesis",
        ms: 0,
      },
      { label: "Fast synthesis", detail: "Streaming live tokens", ms: 0 },
      { label: "Deep reasoning", detail: "Multi-stage research synthesis", ms: 0 },
    ];

    const runAgent = (): Promise<{ text: string; artifact?: Artifact }> =>
      new Promise((resolve, reject) => {
        let finalText = "";
        const queryWithContext = active ? `${text} (Topic: ${active})` : text;
        const candidatePayload = activePapersList.slice(0, 20).map((p) => ({
          id: p.id,
          title: p.title,
          authors: p.authors || [],
          year: p.year || 0,
          journal: p.journal || "",
          citations: p.citations || 0,
          relevance: p.score || 0,
          abstract: p.abstract || "",
          tags: p.tags || [],
          doi: p.doi || "",
          addedAt: p.addedAt || "Just now",
          status: p.status || "unread",
          summary: p.summary || {},
          gaps: p.gaps || [],
          future: p.future || [],
          pdf_url: p.pdfUrl || null,
        }));

        apiStream(
          "/agent/run",
          {
            query: queryWithContext,
            workspace_id: null,
            history: history || [],
            papers: candidatePayload,
          },
          (event, data) => {
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
          },
        ).catch((err) => {
          console.error("Live agent stream failed:", err);
          reject(err);
        });
      });

    return { steps, finish: runAgent, live: true };
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
    if (isGuest) {
      openLoginModal({
        title: "Log in to save papers",
        message: "Workspaces require an account to save curated papers. Log in to continue.",
      });
      return;
    }
    const selectedPapers = results.filter((p) => selected.has(p.id));
    addPapers(ws.id, [...selected], selectedPapers);
    setSelected(new Set());
    setWsPickerOpen(false);
  };

  const createWorkspaceFromSelection = async () => {
    if (isGuest) {
      openLoginModal({
        title: "Log in to create a workspace",
        message:
          "You have selected papers in Discover. Log in to save them into a permanent research workspace.",
      });
      return;
    }
    const name = prompt("Name this workspace:", active);
    if (!name) return;
    try {
      const selectedPapers = results.filter((p) => selected.has(p.id));
      const ws = await create(name, [...selected], selectedPapers);
      setSelected(new Set());
      setWsPickerOpen(false);
      alert(
        `Workspace "${ws.name}" created with ${ws.paperIds.length} papers. Open it in Workflow.`,
      );
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
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
              Type your topic below. Arclight ranks the most similar papers, you pick the ones that
              matter, and the agent works only on those.
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
          className="relative flex gap-2"
        >
          <div ref={searchContainerRef} className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowHistoryDropdown(true);
              }}
              onFocus={() => {
                if (searchHistory.length > 0) {
                  setShowHistoryDropdown(true);
                }
              }}
              placeholder="e.g. reducing hallucinations in scientific LLMs with retrieval"
              className="h-12 bg-card pl-9 pr-14 text-base shadow-md"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}

            {/* Google / YouTube style Search History Dropdown */}
            {showHistoryDropdown && searchHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 border-b border-border/40">
                  <span className="flex items-center gap-1.5">
                    <History className="h-3 w-3 text-accent" /> Recent Searches
                  </span>
                  <button
                    type="button"
                    onClick={clearAllHistory}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="py-1">
                  {searchHistory
                    .filter((item) => !query.trim() || item.toLowerCase().includes(query.toLowerCase().trim()))
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item}
                        onClick={() => {
                          setQuery(item);
                          runSearch(item);
                        }}
                        className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/90 transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
                          <span className="truncate font-medium text-xs sm:text-sm">{item}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeHistoryItem(item, e)}
                          className="rounded p-1 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Remove from history"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
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
                    setSelectedFields([]);
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

              <FilterBlock label="Academic Fields">
                <div className="flex flex-wrap gap-1">
                  {ACADEMIC_FIELDS.map((f) => {
                    const on = selectedFields.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFields((a) => toggle(a, f.id))}
                        className={`btn-pop rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          on
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </FilterBlock>

              <FilterBlock label="Topics">
                <div className="flex flex-wrap gap-1">
                  {COMMON_TOPICS.map((t) => {
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

              {availableVenues.length > 0 && (
                <FilterBlock label="Discovered Venues">
                  <div className="space-y-1">
                    {availableVenues.map((v) => {
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
                          <span className="truncate">{v}</span>
                        </label>
                      );
                    })}
                  </div>
                </FilterBlock>
              )}
            </aside>
          )}

          {/* Results section */}
          <section className={showFilters ? "" : "lg:col-start-1 lg:col-end-3"}>
            {searching ? (
              <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    <span>Querying arXiv & Semantic Scholar in real-time…</span>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                    Retrieving & Ranking
                  </span>
                </div>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="card-3d rounded-xl border border-border bg-card p-4 space-y-2.5 animate-pulse">
                    <div className="flex items-center justify-between gap-4">
                      <div className="h-4 w-3/4 rounded bg-muted" />
                      <div className="h-4 w-12 rounded-full bg-muted" />
                    </div>
                    <div className="h-3 w-1/2 rounded bg-muted/60" />
                    <div className="h-10 w-full rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {!searching && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">
                        {results.length.toLocaleString()}
                      </span>{" "}
                      papers ranked by similarity to{" "}
                      <span className="text-foreground">"{active}"</span>
                      {selected.size === 0 && results.length > 0 && (
                        <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                          Tick the papers you want → add to a workspace
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() =>
                        downloadText(
                          `${slugify(active)}-results-${stamp()}.txt`,
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
                      <span className="font-medium text-foreground">{selected.size}</span> papers
                      selected — scope the agent to just these:
                    </span>
                    <div className="relative flex items-center gap-2">
                      <Button
                        size="sm"
                        className="btn-pop h-8 gap-1"
                        onClick={() => setWsPickerOpen((v) => !v)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" /> Add to workspace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="btn-pop h-8"
                        onClick={() => setSelected(new Set())}
                      >
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
                                    <span className="text-[10px] text-muted-foreground">
                                      {w.paperIds.length}
                                    </span>
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

                {results.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-border bg-card/60 p-8 text-center backdrop-blur">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <SearchIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-display text-lg font-medium">No direct paper matches found</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                      We searched arXiv and Semantic Scholar for "{active}". Try broadening your terms, clearing filters, or exploring suggested research areas below:
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => runSearch(s)}
                          className="btn-pop rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground shadow-sm hover:border-accent hover:text-accent"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <ul className="mt-3 card-3d overflow-hidden rounded-xl border border-border bg-card">
                      {results.map((p, i) => (
                        <ResultRow
                          key={p.id}
                          paper={p}
                          rank={i + 1}
                          checked={selected.has(p.id)}
                          onToggle={() => toggleSelect(p.id)}
                          isStarred={starredIds.has(p.id)}
                          onToggleStar={() => toggleStar(p)}
                        />
                      ))}
                    </ul>

                    {hasMore && (
                      <div className="mt-4 flex justify-center">
                        <Button
                          variant="outline"
                          onClick={loadMore}
                          disabled={loadingMore}
                          className="btn-pop h-9 px-6 text-xs gap-2 border-border shadow-sm hover:border-accent hover:text-accent"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Fetching more papers from arXiv & Semantic Scholar…
                            </>
                          ) : (
                            <>
                              <span>Load More Papers (Page {page + 1})</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>

          {/* Chatbot */}
          <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] flex flex-col gap-2">
            {isGuest && (
              <div className="card-3d rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 text-foreground/85">
                  <span className="live-dot" />
                  <span>
                    <strong>Guest Mode</strong>: Paper search only. Sign in to chat & save tokens.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openLoginModal({
                      title: "Log in to use AI Copilot",
                      message:
                        "Sign in with shlok@mail.com to chat with papers, perform deep reasoning, and generate synthesis without token limits.",
                    })
                  }
                  className="h-7 text-xs px-2.5 font-medium border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                >
                  Sign in
                </Button>
              </div>
            )}
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
  isStarred,
  onToggleStar,
}: {
  paper: Ranked;
  rank: number;
  checked: boolean;
  onToggle: () => void;
  isStarred?: boolean;
  onToggleStar?: () => void;
}) {
  const [copiedBib, setCopiedBib] = useState(false);
  const pct = Math.round(paper.score * 100);

  const handleCopyBib = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const bib = toBibTeX([paper]);
    navigator.clipboard.writeText(bib);
    setCopiedBib(true);
    setTimeout(() => setCopiedBib(false), 2000);
  };

  return (
    <li className="group border-b border-border last:border-b-0 hover:bg-muted/40">
      <div className="grid grid-cols-[24px_28px_28px_1fr_auto] items-start gap-2.5 px-4 py-3.5">
        <label className="pt-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
          />
        </label>
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleStar}
            className={`btn-pop p-0.5 transition-colors ${
              isStarred ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400 opacity-60 group-hover:opacity-100"
            }`}
            title={isStarred ? "Starred in library" : "Star and save to library"}
          >
            <span className="text-sm">{isStarred ? "★" : "☆"}</span>
          </button>
        </div>
        <div className="pt-0.5 text-right font-mono text-[11px] text-muted-foreground">
          {String(rank).padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="text-foreground/70 font-medium">{paper.journal}</span>
            <span>·</span>
            <span>{paper.year}</span>
            <span>·</span>
            <span>{paper.citations.toLocaleString()} cites</span>
            {paper.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background px-1.5 py-0 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
          <Link to="/papers/$id" params={{ id: paper.id }} className="block">
            <h3 className="text-[15px] font-medium leading-snug text-foreground hover:text-accent transition-colors">
              {paper.title}
            </h3>
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate max-w-lg">{paper.authors.join(", ")}</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={handleCopyBib}
                className="btn-pop inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent hover:text-accent transition-colors shadow-sm"
                title="Copy BibTeX Citation Key"
              >
                {copiedBib ? (
                  <>
                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Copied BibTeX!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-2.5 w-2.5" />
                    <span>BibTeX</span>
                  </>
                )}
              </button>

              {paper.pdfUrl && (
                <a
                  href={paper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pop inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent hover:text-accent transition-colors shadow-sm"
                  title="Open Open-Access PDF"
                >
                  <FileText className="h-2.5 w-2.5 text-rose-500" />
                  <span>PDF</span>
                  <ExternalLink className="h-2 w-2 opacity-60" />
                </a>
              )}
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{paper.abstract}</p>
        </div>
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
