import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Plus,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  Circle,
  FolderPlus,
  Star,
  Download,
  ExternalLink,
  LayoutGrid,
  List,
  Check,
  Compass,
  FileText,
  Tag,
  BookMarked,
  Layers,
} from "lucide-react";
import { MOCK_PAPERS, type Paper } from "@/lib/mock-data";
import { getCachedPapers, cachePapers } from "@/lib/paper-cache";
import { downloadText, toBibTeX, stamp } from "@/lib/download";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWorkspaces } from "@/lib/workspaces";

export const Route = createFileRoute("/_app/library")({
  head: () => ({
    meta: [
      { title: "Library · Arclight" },
      {
        name: "description",
        content: "Personal scientific library, starred bookmarks, reading queue, and collection manager.",
      },
      { property: "og:title", content: "Library · Arclight" },
      {
        property: "og:description",
        content: "Personal scientific library, starred bookmarks, reading queue, and collection manager.",
      },
    ],
  }),
  component: LibraryPage,
});

type SortKey = "added" | "citations" | "year" | "title";
type StatusFilter = "all" | "starred" | "reading" | "unread" | "read";
type ViewMode = "grid" | "table";

const STARRED_STORAGE_KEY = "arclight-starred-papers";

export function getStarredPaperIds(): string[] {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStarredPaperIds(ids: string[]) {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn("Failed to persist starred papers", err);
  }
}

function LibraryPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const { workspaces, create, addPapers } = useWorkspaces();

  // Load initial starred papers from localStorage
  useEffect(() => {
    const stored = getStarredPaperIds();
    setStarredIds(new Set(stored));
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Aggregate papers from all user workspaces and local paper cache
  const [papersState, setPapersState] = useState<Paper[]>([]);

  useEffect(() => {
    const allWsPaperIds = Array.from(new Set(workspaces.flatMap((w) => w.paperIds || [])));
    const wsPapers = getCachedPapers(allWsPaperIds);

    let cachedMap: Record<string, Paper> = {};
    try {
      const stored = localStorage.getItem("arclight-paper-cache");
      if (stored) cachedMap = JSON.parse(stored);
    } catch {
      // ignore
    }

    const map = new Map<string, Paper>();
    // Cached papers from searches, stars, and views
    for (const p of Object.values(cachedMap)) map.set(p.id, p);
    // Real workspace-saved papers from backend
    for (const p of wsPapers) map.set(p.id, p);

    setPapersState(Array.from(map.values()));
  }, [workspaces]);

  // Toggle star status on a paper
  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const next = new Set(starredIds);
    const isNowStarred = !next.has(id);
    if (isNowStarred) {
      next.add(id);
      notify("⭐ Paper starred");
    } else {
      next.delete(id);
      notify("Paper unstarred");
    }
    setStarredIds(next);
    saveStarredPaperIds(Array.from(next));
  };

  // Change reading status of a paper
  const updatePaperStatus = (id: string, newStatus: "unread" | "reading" | "read", e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setPapersState((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p));
      cachePapers(updated);
      return updated;
    });
    notify(`Status updated to "${newStatus}"`);
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    papersState.forEach((p) => (p.tags || []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [papersState]);

  // Filter & sort
  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    let rows = papersState.filter((p) => {
      // Status filter
      if (status === "starred") {
        if (!starredIds.has(p.id)) return false;
      } else if (status !== "all") {
        if ((p.status || "unread") !== status) return false;
      }

      // Tag filter
      if (selectedTag && !(p.tags || []).includes(selectedTag)) {
        return false;
      }

      // Search query filter
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        (p.authors || []).some((a) => a.toLowerCase().includes(needle)) ||
        (p.journal || "").toLowerCase().includes(needle) ||
        (p.abstract || "").toLowerCase().includes(needle) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(needle))
      );
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "year":
          return (b.year || 0) - (a.year || 0);
        case "citations":
          return (b.citations || 0) - (a.citations || 0);
        case "title":
          return a.title.localeCompare(b.title);
        case "added":
        default:
          return 0;
      }
    });
    return rows;
  }, [papersState, q, status, sort, selectedTag, starredIds]);

  const counts = useMemo(
    () => ({
      all: papersState.length,
      starred: papersState.filter((p) => starredIds.has(p.id)).length,
      unread: papersState.filter((p) => (p.status || "unread") === "unread").length,
      reading: papersState.filter((p) => p.status === "reading").length,
      read: papersState.filter((p) => p.status === "read").length,
    }),
    [papersState, starredIds],
  );

  // Toggle selection
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  // Bulk actions
  const createWorkspaceFromSelection = () => {
    if (selected.size === 0) return;
    const name = prompt(
      "Name this workspace:",
      `Library selection · ${new Date().toLocaleDateString()}`,
    );
    if (!name) return;
    const selectedPapers = papersState.filter((p) => selected.has(p.id));
    create(name, Array.from(selected), selectedPapers);
    setSelected(new Set());
    notify(`Workspace "${name}" created with ${selected.size} papers`);
  };

  const addSelectedToExistingWorkspace = (wsId: string) => {
    addPapers(wsId, Array.from(selected));
    setWsDropdownOpen(false);
    setSelected(new Set());
    notify(`Added ${selected.size} papers to workspace`);
  };

  const markSelectedStatus = (newStatus: "unread" | "reading" | "read") => {
    setPapersState((prev) => {
      const updated = prev.map((p) => (selected.has(p.id) ? { ...p, status: newStatus } : p));
      cachePapers(updated);
      return updated;
    });
    notify(`Marked ${selected.size} papers as ${newStatus}`);
    setSelected(new Set());
  };

  const exportBibTeX = () => {
    const target = selected.size > 0 ? papersState.filter((p) => selected.has(p.id)) : filtered;
    const bib = toBibTeX(target);
    downloadText(`arclight-library-${stamp()}.bib`, bib, "application/x-bibtex");
    notify(`Exported ${target.length} papers as BibTeX`);
  };

  const exportJSON = () => {
    const target = selected.size > 0 ? papersState.filter((p) => selected.has(p.id)) : filtered;
    const json = JSON.stringify(target, null, 2);
    downloadText(`arclight-library-${stamp()}.json`, json, "application/json");
    notify(`Exported ${target.length} papers as JSON`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-primary/20 bg-background/95 px-4 py-2.5 text-xs font-medium text-foreground shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4 text-emerald-500" />
          {notification}
        </div>
      )}

      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Library</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {counts.all} saved papers · {counts.starred} starred · {counts.reading} currently reading
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportBibTeX}
            className="btn-pop h-8 gap-1.5 text-xs"
            title="Export filtered collection to BibTeX"
          >
            <Download className="h-3.5 w-3.5" /> BibTeX
          </Button>

          <Link to="/workflow">
            <Button variant="outline" size="sm" className="btn-pop h-8 gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" /> Workspaces
            </Button>
          </Link>

          <Link to="/search">
            <Button size="sm" className="btn-pop h-8 gap-1.5 bg-primary text-xs">
              <Compass className="h-3.5 w-3.5" /> Discover Papers
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, author, venue, abstract, tag…"
              className="h-10 border-border bg-card/60 pl-9 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-primary/40"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 text-xs">
            <button
              onClick={() => setStatus("all")}
              className={`btn-pop flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                status === "all"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All <span className="text-[11px] opacity-60">({counts.all})</span>
            </button>

            <button
              onClick={() => setStatus("starred")}
              className={`btn-pop flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                status === "starred"
                  ? "bg-background text-amber-500 shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${status === "starred" ? "fill-amber-400 text-amber-400" : ""}`} />
              Starred <span className="text-[11px] opacity-60">({counts.starred})</span>
            </button>

            <button
              onClick={() => setStatus("reading")}
              className={`btn-pop flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                status === "reading"
                  ? "bg-background text-blue-500 shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Reading <span className="text-[11px] opacity-60">({counts.reading})</span>
            </button>

            <button
              onClick={() => setStatus("unread")}
              className={`btn-pop flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                status === "unread"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Circle className="h-3.5 w-3.5" />
              Unread <span className="text-[11px] opacity-60">({counts.unread})</span>
            </button>

            <button
              onClick={() => setStatus("read")}
              className={`btn-pop flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                status === "read"
                  ? "bg-background text-emerald-500 shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Read <span className="text-[11px] opacity-60">({counts.read})</span>
            </button>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="cursor-pointer bg-transparent py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="added">Recently Added</option>
              <option value="citations">Most Cited</option>
              <option value="year">Newest Year</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3 w-3" /> Tags:
            </span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="btn-pop rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
              >
                Clear tag filter ×
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`btn-pop rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Bulk Action Banner */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11px] text-primary-foreground">
                {selected.size} selected
              </span>
              <button onClick={selectAll} className="text-muted-foreground hover:text-foreground underline">
                {selected.size === filtered.length ? "Deselect all" : "Select all in view"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => markSelectedStatus("read")}
                className="btn-pop h-7 gap-1 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Mark Read
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => markSelectedStatus("reading")}
                className="btn-pop h-7 gap-1 text-xs"
              >
                <BookOpen className="h-3 w-3 text-blue-500" /> Mark Reading
              </Button>

              <div className="relative">
                <Button
                  size="sm"
                  className="btn-pop h-7 gap-1 text-xs"
                  onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Add to Workspace
                </Button>

                {wsDropdownOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Select workspace:</div>
                    <button
                      onClick={createWorkspaceFromSelection}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary hover:bg-primary/10 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" /> Create new workspace
                    </button>
                    {workspaces.length > 0 && <div className="my-1 border-t border-border" />}
                    {workspaces.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => addSelectedToExistingWorkspace(w.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                      >
                        <span className="truncate">{w.name}</span>
                        <span className="text-[10px] text-muted-foreground">{w.paperIds.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={exportBibTeX}
                className="btn-pop h-7 gap-1 text-xs"
              >
                <Download className="h-3 w-3" /> Export BibTeX
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                className="btn-pop h-7 text-xs text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-medium text-foreground">No papers found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {status !== "all" || q || selectedTag
              ? "No papers match your active filters or search query."
              : "Your library is currently empty. Explore papers in Discover to start building your personal library."}
          </p>
          <div className="mt-4 flex gap-2">
            {(q || status !== "all" || selectedTag) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                  setSelectedTag(null);
                }}
                className="text-xs"
              >
                Reset filters
              </Button>
            )}
            <Link to="/search">
              <Button size="sm" className="text-xs gap-1.5">
                <Compass className="h-3.5 w-3.5" /> Go to Discover
              </Button>
            </Link>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((paper) => {
            const isStarred = starredIds.has(paper.id);
            const isSelected = selected.has(paper.id);
            const currentStatus = paper.status || "unread";

            return (
              <div
                key={paper.id}
                className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:shadow-lg ${
                  isSelected
                    ? "border-primary bg-primary/[0.03] ring-1 ring-primary"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div>
                  {/* Card Header: Checkbox, Status selector, Star */}
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(paper.id, e as unknown as React.MouseEvent)}
                        className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
                      />

                      {/* Reading Status Pill / Selector */}
                      <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px]">
                        {currentStatus === "read" ? (
                          <button
                            onClick={(e) => updatePaperStatus(paper.id, "unread", e)}
                            className="flex items-center gap-1 font-medium text-emerald-500 hover:opacity-80"
                            title="Click to toggle unread"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Read
                          </button>
                        ) : currentStatus === "reading" ? (
                          <button
                            onClick={(e) => updatePaperStatus(paper.id, "read", e)}
                            className="flex items-center gap-1 font-medium text-blue-500 hover:opacity-80"
                            title="Click to mark read"
                          >
                            <BookOpen className="h-3 w-3" /> Reading
                          </button>
                        ) : (
                          <button
                            onClick={(e) => updatePaperStatus(paper.id, "reading", e)}
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            title="Click to mark reading"
                          >
                            <Circle className="h-3 w-3" /> Unread
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Star Button */}
                    <button
                      onClick={(e) => toggleStar(paper.id, e)}
                      className={`btn-pop rounded-full p-1.5 transition-colors ${
                        isStarred
                          ? "text-amber-400 hover:text-amber-500"
                          : "text-muted-foreground/40 hover:text-amber-400 opacity-80 group-hover:opacity-100"
                      }`}
                      title={isStarred ? "Starred (click to unstar)" : "Star paper"}
                    >
                      <Star className={`h-4 w-4 ${isStarred ? "fill-amber-400" : ""}`} />
                    </button>
                  </div>

                  {/* Title */}
                  <Link
                    to="/papers/$id"
                    params={{ id: paper.id }}
                    className="block group-hover:text-primary transition-colors"
                  >
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {paper.title}
                    </h3>
                  </Link>

                  {/* Authors & Venue */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="line-clamp-1 font-medium text-foreground/80">
                      {paper.authors.slice(0, 3).join(", ")}
                      {paper.authors.length > 3 ? " et al." : ""}
                    </span>
                    <span>·</span>
                    <span>{paper.journal || "ArXiv"}</span>
                    <span>·</span>
                    <span>{paper.year}</span>
                  </div>

                  {/* Objective / Abstract excerpt */}
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground/90">
                    {paper.summary?.objective || paper.abstract}
                  </p>
                </div>

                {/* Card Footer: Tags, Citations, Actions */}
                <div className="mt-4 border-t border-border/40 pt-3">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {(paper.tags || []).slice(0, 3).map((tag) => (
                      <button
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(selectedTag === tag ? null : tag);
                        }}
                        className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        #{tag}
                      </button>
                    ))}
                    {(paper.tags || []).length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{paper.tags.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] tabular-nums">
                      {paper.citations.toLocaleString()} citations
                    </span>

                    <div className="flex items-center gap-2">
                      {paper.pdfUrl && (
                        <a
                          href={paper.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                          title="Open PDF"
                        >
                          <FileText className="h-3 w-3" /> PDF
                        </a>
                      )}
                      <Link
                        to="/papers/$id"
                        params={{ id: paper.id }}
                        className="flex items-center gap-0.5 text-[11px] font-medium text-foreground hover:text-primary"
                      >
                        Details <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[36px_36px_1fr_120px_70px_80px_100px] items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === filtered.length}
              onChange={selectAll}
              className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
            />
            <span>⭐</span>
            <span>Paper</span>
            <span className="hidden md:block">Venue</span>
            <span className="hidden sm:block text-right">Year</span>
            <span className="text-right">Citations</span>
            <span className="text-right">Status</span>
          </div>

          <ul className="divide-y divide-border/50">
            {filtered.map((paper) => {
              const isStarred = starredIds.has(paper.id);
              const isSelected = selected.has(paper.id);
              const currentStatus = paper.status || "unread";

              return (
                <li
                  key={paper.id}
                  className={`group grid grid-cols-[36px_36px_1fr_120px_70px_80px_100px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                    isSelected ? "bg-primary/[0.02]" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelect(paper.id, e as unknown as React.MouseEvent)}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                  />

                  <button
                    onClick={(e) => toggleStar(paper.id, e)}
                    className={`btn-pop p-1 text-xs ${
                      isStarred ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-amber-400" : ""}`} />
                  </button>

                  <div className="min-w-0 pr-2">
                    <Link
                      to="/papers/$id"
                      params={{ id: paper.id }}
                      className="block truncate text-xs font-semibold text-foreground hover:text-primary sm:text-sm"
                    >
                      {paper.title}
                    </Link>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {paper.authors.slice(0, 2).join(", ")}
                      {paper.authors.length > 2 ? " et al." : ""}
                      {(paper.tags || []).length > 0 && (
                        <span className="ml-2 opacity-70">
                          {paper.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="hidden truncate text-xs text-muted-foreground md:block">
                    {paper.journal || "ArXiv"}
                  </span>

                  <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                    {paper.year}
                  </span>

                  <span className="text-right text-xs tabular-nums font-mono text-muted-foreground">
                    {paper.citations.toLocaleString()}
                  </span>

                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        const nextStatus =
                          currentStatus === "unread" ? "reading" : currentStatus === "reading" ? "read" : "unread";
                        updatePaperStatus(paper.id, nextStatus, e);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        currentStatus === "read"
                          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          : currentStatus === "reading"
                            ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {currentStatus === "read" ? (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5" /> Read
                        </>
                      ) : currentStatus === "reading" ? (
                        <>
                          <BookOpen className="h-2.5 w-2.5" /> Reading
                        </>
                      ) : (
                        <>
                          <Circle className="h-2.5 w-2.5" /> Unread
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bottom Summary Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/40 pt-4">
        <div>
          Showing {filtered.length} of {papersState.length} papers
          {selected.size > 0 && ` · ${selected.size} selected`}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={exportJSON} className="hover:text-foreground underline">
            Export as JSON
          </button>
          <span>·</span>
          <button onClick={exportBibTeX} className="hover:text-foreground underline">
            Export as BibTeX (.bib)
          </button>
        </div>
      </div>
    </div>
  );
}
