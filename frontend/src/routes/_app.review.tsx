import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  AlertCircle,
  ChevronRight,
  Check,
  FolderOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useDocuments, type Doc } from "@/lib/documents";
import { useWorkspaces } from "@/lib/workspaces";
import { downloadText, slugify } from "@/lib/download";

export const Route = createFileRoute("/_app/review")({
  head: () => ({
    meta: [
      { title: "Review · Arclight" },
      { name: "description", content: "Review and export AI-generated documents from your workspaces." },
      { property: "og:title", content: "Review · Arclight" },
      { property: "og:description", content: "Review and export AI-generated documents from your workspaces." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { workspaces } = useWorkspaces();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>(
    workspaces[0]?.id,
  );
  const { docs } = useDocuments(activeWorkspaceId);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  // When a different workspace is chosen, clear the selection
  const handleWorkspaceChange = (id: string) => {
    setActiveWorkspaceId(id);
    setSelectedDoc(null);
  };

  // Use selectedDoc if set, otherwise default to the first done doc
  const activeDoc =
    selectedDoc ??
    docs.find((d) => d.status === "done") ??
    docs[0] ??
    null;

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-8 lg:self-start space-y-4">
        {/* Workspace selector */}
        {workspaces.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Workspace
            </div>
            <div className="space-y-0.5">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceChange(ws.id)}
                  className={`btn-pop w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    ws.id === activeWorkspaceId
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {ws.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Document list */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Documents
          </div>
          {docs.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              No documents yet.{" "}
              {activeWs ? (
                <Link
                  to="/workflow/$id"
                  params={{ id: activeWs.id }}
                  className="text-accent hover:underline"
                >
                  Open workspace →
                </Link>
              ) : (
                "Generate one from a workspace."
              )}
            </p>
          ) : (
            <ol className="space-y-0.5">
              {docs.map((d) => {
                const isActive = d.id === activeDoc?.id;
                const isDone = d.status === "done";
                const isRunning = d.status === "pending" || d.status === "processing";
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => setSelectedDoc(d)}
                      className={`btn-pop group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-accent/10 font-medium text-accent"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3 shrink-0 text-live" />
                      ) : isRunning ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
                      ) : (
                        <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      {isActive && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>

      {/* Main content */}
      <article className="min-w-0">
        {!activeDoc ? (
          <EmptyState workspaceId={activeWorkspaceId} workspaceName={activeWs?.name} />
        ) : (
          <DocView doc={activeDoc} />
        )}
      </article>
    </div>
  );
}

function DocView({ doc }: { doc: Doc }) {
  const isRunning = doc.status === "pending" || doc.status === "processing";
  const isFailed = doc.status === "failed";
  const isDone = doc.status === "done";

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            {isRunning ? (
              <>
                <span className="live-dot" />
                <span>Generating in background — safe to close and return later</span>
              </>
            ) : isDone ? (
              <>
                <Check className="h-3.5 w-3.5 text-live" />
                <span>
                  Ready · {doc.words.toLocaleString()} words · {doc.kind}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">Generation failed</span>
              </>
            )}
          </div>
          <h1 className="font-display text-4xl leading-tight">{doc.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(doc.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            disabled={!isDone}
            onClick={() => downloadText(`${slugify(doc.title)}.md`, doc.content, "text/plain")}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isDone}
            onClick={() => navigator.clipboard?.writeText(doc.content)}
          >
            Copy
          </Button>
        </div>
      </div>

      {/* Body */}
      {isRunning && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/60 py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <div className="space-y-1">
            <p className="font-medium">Generating in the background</p>
            <p className="text-sm text-muted-foreground">
              This document keeps running even if you close the tab.
              <br />
              Come back anytime — it'll be here when it's done.
            </p>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center text-destructive">
          <AlertCircle className="h-7 w-7" />
          <p className="font-medium">Generation failed</p>
          {doc.error && (
            <p className="max-w-prose text-sm opacity-80">{doc.error}</p>
          )}
        </div>
      )}

      {isDone && (
        <div className="agent-md prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </div>
      )}
    </>
  );
}

function EmptyState({
  workspaceId,
  workspaceName,
}: {
  workspaceId?: string;
  workspaceName?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/40 py-32 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <FolderOpen className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="font-display text-2xl">No documents yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Generate a literature review, report, or summary from any workspace — it'll appear here once it's ready.
        </p>
      </div>
      {workspaceId ? (
        <Link to="/workflow/$id" params={{ id: workspaceId }}>
          <Button size="sm" className="btn-pop gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Go to {workspaceName ?? "workspace"} →
          </Button>
        </Link>
      ) : (
        <Link to="/workflow">
          <Button size="sm" variant="outline" className="btn-pop">
            Open a workspace
          </Button>
        </Link>
      )}
    </div>
  );
}
