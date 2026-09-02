import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Loader2,
  Star,
  BookOpen,
  CheckCircle2,
  Circle,
  FolderPlus,
  Plus,
  Check,
} from "lucide-react";
import { type Paper } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getCachedPapers, cachePapers, searchCachedPapers } from "@/lib/paper-cache";
import { useWorkspaces } from "@/lib/workspaces";

export const Route = createFileRoute("/_app/papers/$id")({
  loader: async ({ params }) => {
    let paper = getCachedPapers([params.id])[0];
    if (!paper) {
      try {
        const raw = await apiFetch<Paper & { relevance?: number; pdf_url?: string }>(
          `/papers/${params.id}`,
        );
        paper = {
          ...raw,
          relevance: raw.relevance ?? 0.0,
          pdfUrl: raw.pdf_url,
        };
        cachePapers([paper]);
      } catch (err) {
        console.warn(`Could not load paper ${params.id} from API:`, err);
      }
    }
    if (!paper) throw notFound();
    return { paper };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.paper.title} · Arclight` },
            { name: "description", content: loaderData.paper.abstract.slice(0, 155) },
            { property: "og:title", content: loaderData.paper.title },
            { property: "og:description", content: loaderData.paper.abstract.slice(0, 155) },
          ],
        }
      : { meta: [{ title: "Paper · Arclight" }, { name: "robots", content: "noindex" }] },
  component: PaperPage,
});

const SECTIONS = [
  { key: "objective", label: "Objective" },
  { key: "methodology", label: "Method" },
  { key: "dataset", label: "Dataset" },
  { key: "results", label: "Results" },
  { key: "limitations", label: "Limitations" },
] as const;

function PaperPage() {
  const { paper } = Route.useLoaderData();
  const [similarPapers, setSimilarPapers] = useState<
    (Paper & { score?: number; isVector?: boolean })[]
  >([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [status, setStatus] = useState<"unread" | "reading" | "read">(paper.status || "unread");
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const { workspaces, create, addPapers } = useWorkspaces();

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Load star state & auto-transition to reading
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arclight-starred-papers");
      const starred = raw ? JSON.parse(raw) : [];
      setIsStarred(starred.includes(paper.id));
    } catch {
      // ignore
    }

    // Auto-transition unread -> reading when paper details are opened
    if ((paper.status || "unread") === "unread") {
      const updated: Paper = { ...paper, status: "reading" };
      cachePapers([updated]);
      setStatus("reading");
    }
  }, [paper.id]);

  const toggleStar = () => {
    try {
      const raw = localStorage.getItem("arclight-starred-papers");
      const starred: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      if (starred.includes(paper.id)) {
        next = starred.filter((id) => id !== paper.id);
        setIsStarred(false);
        notify("Paper unstarred");
      } else {
        next = [...starred, paper.id];
        setIsStarred(true);
        cachePapers([paper]);
        notify("⭐ Paper starred and saved to Library");
      }
      localStorage.setItem("arclight-starred-papers", JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to toggle star:", err);
    }
  };

  const updateStatus = (newStatus: "unread" | "reading" | "read") => {
    setStatus(newStatus);
    const updated: Paper = { ...paper, status: newStatus };
    cachePapers([updated]);
    notify(`Reading status set to "${newStatus}"`);
  };

  const handleAddToWorkspace = (wsId: string) => {
    addPapers(wsId, [paper.id]);
    setWsDropdownOpen(false);
    notify("Paper added to workspace");
  };

  const handleCreateWorkspace = () => {
    const name = prompt("Name this workspace:", `${paper.title.slice(0, 32)}… Workspace`);
    if (!name) return;
    create(name, [paper.id], [paper]);
    setWsDropdownOpen(false);
    notify(`Workspace "${name}" created with this paper`);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadSimilar() {
      try {
        const data = await apiFetch<(Paper & { relevance?: number; pdf_url?: string })[]>(
          `/papers/${paper.id}/similar?limit=4`,
        );
        if (!cancelled && data && data.length > 0) {
          const mapped = data.map((p) => ({
            ...p,
            score: p.relevance ?? 0.0,
            pdfUrl: p.pdf_url,
            isVector: true,
          }));
          setSimilarPapers(mapped);
          cachePapers(mapped);
          return;
        }
      } catch (err) {
        console.info("Vector similarity unavailable, using cached fallback:", err);
      }

      if (!cancelled) {
        const fallback = searchCachedPapers(paper.title, [paper.id]).slice(0, 4);
        setSimilarPapers(fallback);
      }
    }

    setLoadingSimilar(true);
    loadSimilar().finally(() => {
      if (!cancelled) setLoadingSimilar(false);
    });

    return () => {
      cancelled = true;
    };
  }, [paper.id, paper.title]);

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-6 py-8 lg:grid-cols-[1fr_260px]">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-primary/20 bg-background/95 px-4 py-2.5 text-xs font-medium text-foreground shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4 text-emerald-500" />
          {notification}
        </div>
      )}

      <div className="min-w-0">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/search";
            }
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Hero */}
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{paper.journal || "ArXiv"}</span>
            <span>·</span>
            <span>{paper.year}</span>
            <span>·</span>
            <span>{(paper.citations || 0).toLocaleString()} citations</span>
            {paper.doi && (
              <>
                <span>·</span>
                <span className="font-mono">{paper.doi}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{paper.title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            {(paper.authors || []).join(", ")}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* Star button */}
            <Button
              size="sm"
              variant={isStarred ? "default" : "outline"}
              onClick={toggleStar}
              className={`btn-pop gap-1.5 ${isStarred ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
            >
              <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-white" : ""}`} />
              {isStarred ? "Starred" : "Star Paper"}
            </Button>

            {/* Reading Status Pill */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <button
                onClick={() => updateStatus("reading")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                  status === "reading"
                    ? "bg-blue-500/10 font-medium text-blue-500 shadow-sm ring-1 ring-blue-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="h-3 w-3" /> Reading
              </button>
              <button
                onClick={() => updateStatus("read")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                  status === "read"
                    ? "bg-emerald-500/10 font-medium text-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" /> Read
              </button>
              <button
                onClick={() => updateStatus("unread")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                  status === "unread"
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Circle className="h-3 w-3" /> Unread
              </button>
            </div>

            {/* Add to Workspace dropdown */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="btn-pop gap-1.5"
              >
                <FolderPlus className="h-3.5 w-3.5" /> Workspace
              </Button>

              {wsDropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                  <button
                    onClick={handleCreateWorkspace}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary hover:bg-primary/10 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create new workspace
                  </button>
                  {workspaces.length > 0 && <div className="my-1 border-t border-border" />}
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleAddToWorkspace(w.id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      <span className="truncate">{w.name}</span>
                      <span className="text-[10px] text-muted-foreground">{w.paperIds.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PDF Link */}
            {paper.pdfUrl ? (
              <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Open PDF
                </Button>
              </a>
            ) : (
              <Button size="sm" variant="outline" disabled title="No PDF available" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Open PDF
              </Button>
            )}

            <Link to="/library">
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
                View in Library <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <div className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Abstract
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{paper.abstract}</p>
          </div>
        )}

        {/* Structured summary */}
        {paper.summary && (
          <div className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              AI summary
            </h2>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {SECTIONS.map((s) => {
                const summaryRecord = paper.summary as
                  Record<string, string | undefined> | undefined;
                const val = summaryRecord?.[s.key];
                if (!val) return null;
                return (
                  <div key={s.key} className="grid grid-cols-[100px_1fr] gap-4 py-3">
                    <dt className="text-sm font-medium text-foreground/70">{s.label}</dt>
                    <dd className="text-sm leading-relaxed text-foreground/90">{val}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}

        {/* Gaps & Future */}
        {((paper.gaps && paper.gaps.length > 0) || (paper.future && paper.future.length > 0)) && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {paper.gaps && paper.gaps.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Gaps
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {paper.gaps.map((g: string) => (
                    <li key={g} className="flex gap-2 text-foreground/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {paper.future && paper.future.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Future work
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {paper.future.map((f: string) => (
                    <li key={f} className="flex gap-2 text-foreground/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Similar papers
          </h3>
          {similarPapers.some((p) => p.isVector) && (
            <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <Sparkles className="h-3 w-3" /> pgvector
            </span>
          )}
        </div>
        {loadingSimilar ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding related papers...
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {similarPapers.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card/60 p-2.5 transition hover:border-accent/40"
              >
                <Link to="/papers/$id" params={{ id: r.id }} className="group block">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {r.journal || "ArXiv"} · {r.year}
                    </span>
                    {typeof r.score === "number" && r.score > 0 && (
                      <span className="font-mono text-[10px] text-accent">
                        {Math.round(r.score * 100)}% match
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-medium text-foreground group-hover:text-accent">
                    {r.title}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
