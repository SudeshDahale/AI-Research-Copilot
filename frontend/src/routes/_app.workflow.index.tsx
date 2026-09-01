import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FolderKanban, Plus, Trash2, ArrowRight, Sparkles } from "lucide-react";
import { useWorkspaces } from "@/lib/workspaces";
import { getCachedPapers } from "@/lib/paper-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/workflow/")({
  head: () => ({
    meta: [
      { title: "Workspaces · Arclight" },
      { name: "description", content: "Manage your curated research workspaces." },
      { property: "og:title", content: "Workspaces · Arclight" },
      {
        property: "og:description",
        content: "Scoped agent analysis on curated paper collections.",
      },
    ],
  }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const { workspaces, create, remove } = useWorkspaces();
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const ws = await create(name);
      setName("");
      navigate({ to: "/workflow/$id", params: { id: ws.id } });
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <span className="live-dot" /> Scoped agent · per-workspace reasoning
          </div>
          <h1 className="font-display text-4xl">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate papers into workspaces. The agent analyzes only what's inside — sharper, deeper,
            specific.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="card-3d mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
      >
        <FolderKanban className="ml-1 h-4 w-4 text-muted-foreground" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name a new workspace — e.g. RAG for scientific claims"
          className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm" className="btn-pop gap-1">
          <Plus className="h-4 w-4" /> Create workspace
        </Button>
      </form>

      {workspaces.length === 0 ? (
        <div className="card-3d rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10 text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="font-display text-2xl">No workspaces yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start by searching in Discover, then add the papers that matter into a named workspace.
            The agent will focus only on those.
          </p>
          <Link to="/search" className="mt-4 inline-block">
            <Button className="btn-pop gap-1">
              Start a search <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => {
            const preview = getCachedPapers(w.paperIds).slice(0, 3);
            return (
              <div
                key={w.id}
                className="card-3d group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete workspace "${w.name}"?`)) remove(w.id);
                    }}
                    className="btn-pop rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Link to="/workflow/$id" params={{ id: w.id }} className="block">
                  <h3 className="truncate font-display text-xl leading-tight group-hover:text-accent">
                    {w.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {w.paperIds.length} paper{w.paperIds.length === 1 ? "" : "s"} ·{" "}
                    {new Date(w.createdAt).toLocaleDateString()}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {preview.length > 0 ? (
                      preview.map((p) => (
                        <li key={p.id} className="truncate text-xs text-foreground/70">
                          · {p.title}
                        </li>
                      ))
                    ) : w.paperIds.length > 0 ? (
                      <li className="text-xs text-foreground/70">
                        · {w.paperIds.length} paper{w.paperIds.length === 1 ? "" : "s"} saved
                      </li>
                    ) : (
                      <li className="text-xs italic text-muted-foreground">Empty — add papers</li>
                    )}
                  </ul>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">
                    Open workspace{" "}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
