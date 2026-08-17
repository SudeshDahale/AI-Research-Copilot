import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, FolderKanban, Pencil, Plus, Trash2, X } from "lucide-react";
import { useWorkspaces } from "@/lib/workspaces";
import { useDocuments, type Doc } from "@/lib/documents";
import { getCachedPapers, searchCachedPapers } from "@/lib/paper-cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentChat } from "@/components/agent/AgentChat";
import { DocumentList, DocumentViewer } from "@/components/DocumentPanel";
import { buildAgentReply } from "@/lib/agent";
import {
  answerSteps,
  buildDocument,
  documentSteps,
  gapAgentSteps,
  litReviewAgentSteps,
  genericAgentSteps,
  type Artifact,
} from "@/lib/agent-plan";
import { downloadText, slugify, stamp } from "@/lib/download";
import { apiStream } from "@/lib/api";


export const Route = createFileRoute("/_app/workflow/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Workspace · Arclight` },
      { name: "description", content: `Scoped research agent for workspace ${params.id}.` },
      { property: "og:title", content: "Workspace · Arclight" },
      { property: "og:description", content: "Deep, paper-specific analysis inside a curated workspace." },
    ],
  }),
  component: WorkspaceDetail,
});

function WorkspaceDetail() {
  const { id } = Route.useParams();
  const { workspaces, rename, remove, removePaper, addPapers } = useWorkspaces();
  const ws = workspaces.find((w) => w.id === id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ws?.name ?? "");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"papers" | "docs">("papers");
  const [openDoc, setOpenDoc] = useState<Doc | null>(null);
  const { docs, create: createDoc, remove: removeDoc } = useDocuments(id);

  const papers = useMemo(
    () => (ws ? getCachedPapers(ws.paperIds) : []),
    [ws],
  );

  const execute = (text: string, toolId: string | null, onProgress: (i: number) => void) => {
    const wantsDoc = toolId === "doc" || /document|report|write.?up|draft/i.test(text);

    if (wantsDoc) {
      // Sprint 8: document generation is now a durable background job, not
      // part of the live SSE agent chat. Enqueue it and return right away -
      // the Documents tab polls Postgres for real progress, so this keeps
      // running even if the tab closes mid-generation.
      const kind = /review/i.test(text)
        ? "Literature review"
        : /summar/i.test(text)
          ? "Summary"
          : /outline/i.test(text)
            ? "Outline"
            : /brief/i.test(text)
              ? "Brief"
              : "Report";
      const title = text.replace(/^(generate|create|write|draft)\s+(a|an|the)?\s*/i, "").trim() || kind;

      const steps = [
        { label: "Queuing document job", detail: title, ms: 0 },
        { label: "Enqueued", detail: "Generating in the background", ms: 0 },
      ];

      const finish = async () => {
        onProgress(0);
        const doc = await createDoc({ workspaceId: id, title, kind: kind as Doc["kind"], prompt: text });
        onProgress(steps.length);
        const artifact: Artifact = { type: "document", id: doc.id, title: doc.title, kind: doc.kind };
        return {
          text: `Started generating **${doc.title}** in the background. It'll appear in the **Documents** tab — you can close this tab and it'll keep going; reopen anytime to check progress or read it once it's ready.`,
          artifact,
        };
      };

      return { steps, finish, live: true };
    }

    const lower = text.toLowerCase();

    // Pick the step list that matches the real graph path this question
    // will take (mirrors detect_task() in backend/app/agents/graph.py).
    const steps =
      lower.includes("gap") || lower.includes("missing") || lower.includes("under")
        ? gapAgentSteps(papers.length)
        : lower.includes("literature review") || lower.includes("related work") || lower.includes("draft")
          ? litReviewAgentSteps(papers.length)
          : genericAgentSteps(papers.length);

    let stepCount = 0;

    const runAgent = (): Promise<{ text: string; artifact?: Artifact }> =>
      new Promise((resolve, reject) => {
        let finalText = "";
        apiStream("/agent/run", { query: text, workspace_id: id }, (event, data) => {
          if (event === "step") {
            stepCount = Math.min(stepCount + 1, steps.length - 1);
            onProgress(stepCount);
          } else if (event === "done") {
            finalText = data.text ?? "";
            onProgress(steps.length);
            resolve({ text: finalText });
          } else if (event === "error") {
            reject(new Error(data.message ?? "Agent run failed"));
          }
        }).catch(reject);
      });

    return { steps, finish: runAgent, live: true };
  };


  const candidates = useMemo(() => {
    if (!ws) return [];
    return searchCachedPapers(q, ws.paperIds);
  }, [ws, q]);

  if (!ws) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-3xl">Workspace not found</h1>
        <Link to="/workflow" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Workspaces
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/workflow" className="hover:text-foreground">Workspaces</Link>
        <span>/</span>
        <span className="text-foreground">{ws.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            {editing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await rename(ws.id, name);
                  setEditing(false);
                }}
                className="flex items-center gap-2"
              >
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-lg" autoFocus />
                <Button size="sm" type="submit" className="btn-pop">Save</Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-4xl">{ws.name}</h1>
                <button
                  onClick={() => setEditing(true)}
                  className="btn-pop rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {papers.length} paper{papers.length === 1 ? "" : "s"} · scoped agent active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="btn-pop gap-1" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> Add papers
          </Button>
          <Button
            size="sm"
            className="btn-pop gap-1"
            disabled={papers.length === 0}
            onClick={() => {
              const scope = `"${ws.name}"`;
              const report = [
                `# ${ws.name} — research report`,
                `_${papers.length} papers · generated ${stamp()} by Arclight_`,
                buildAgentReply("summarize corpus", papers, scope),
                buildAgentReply("write literature review", papers, scope),
                buildAgentReply("find research gaps", papers, scope),
                buildAgentReply("compare methodologies", papers, scope),
                `## Bibliography\n` +
                  papers
                    .map(
                      (p, i) =>
                        `${i + 1}. ${p.authors.join(", ")} (${p.year}). *${p.title}*. ${p.journal}. ${p.citations} citations.`,
                    )
                    .join("\n"),
              ].join("\n\n---\n\n");
              downloadText(`${slugify(ws.name)}-report-${stamp()}.txt`, report, "text/plain");
            }}
          >
            <Download className="h-4 w-4" /> Export report
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="btn-pop gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              if (confirm(`Delete workspace "${ws.name}"?`)) {
                await remove(ws.id);
                navigate({ to: "/workflow" });
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          {adding && (
            <div className="card-3d rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Add papers
                </span>
                <button onClick={() => setAdding(false)} className="btn-pop rounded p-1 hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all papers…"
                className="h-9 text-sm"
                autoFocus
              />
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {candidates.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{p.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {p.journal} · {p.year}
                      </div>
                    </div>
                    <button
                      onClick={() => addPapers(ws.id, [p.id])}
                      className="btn-pop rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-accent hover:text-accent"
                    >
                      Add
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted-foreground">No matches.</li>
                )}
              </ul>
            </div>
          )}

          <div className="mb-3 flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs">
            {(
              [
                ["papers", `Papers in scope (${papers.length})`],
                ["docs", `Documents (${docs.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`btn-pop flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  tab === key
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "docs" ? (
                  <FileText className="mr-1.5 inline h-3.5 w-3.5" />
                ) : (
                  <FolderKanban className="mr-1.5 inline h-3.5 w-3.5" />
                )}
                {label}
              </button>
            ))}
          </div>

          {tab === "docs" ? (
            <DocumentList docs={docs} onOpen={setOpenDoc} onRemove={removeDoc} />
          ) : (
          <div className="card-3d overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Papers in scope
            </div>
            {papers.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">Empty workspace.</p>
                <Link to="/search" className="mt-3 inline-block">
                  <Button size="sm" className="btn-pop">Find papers in Discover</Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {papers.map((p, i) => (
                  <li key={p.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40">
                    <span className="pt-0.5 font-mono text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Link to="/papers/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                      <div className="mb-0.5 text-[11px] text-muted-foreground">
                        {p.journal} · {p.year} · {p.citations.toLocaleString()} cites
                      </div>
                      <h3 className="text-sm font-medium leading-snug group-hover:text-accent">
                        {p.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.abstract}</p>
                    </Link>
                    <button
                      onClick={() => removePaper(ws.id, p.id)}
                      className="btn-pop rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <AgentChat
            key={ws.id}
            papers={papers}
            scope={`"${ws.name}"`}
            title="Workspace Agent"
            subtitle={`Scoped to ${papers.length} paper${papers.length === 1 ? "" : "s"}`}
            seedMessage={
              papers.length
                ? `Workspace loaded with ${papers.length} paper${papers.length === 1 ? "" : "s"}. I'll reason only within this scope — ask for gaps or comparisons, or hit **+ → Generate document** to have me write one.`
                : `This workspace is empty. Add papers from Discover, then I'll analyze only those.`
            }
            tools={[{ id: "doc", label: "Generate document", icon: FileText }]}
            suggestions={[
              "Generate a literature review",
              "Find research gaps",
              "Compare methodologies",
            ]}
            execute={execute}
            renderArtifact={(a) =>
              a.type === "document" ? (
                <button
                  onClick={() => {
                    const d = docs.find((x) => x.id === a.id);
                    if (d) {
                      setTab("docs");
                      setOpenDoc(d);
                    }
                  }}
                  className="card-3d flex w-full items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-left text-xs hover:border-accent"
                >
                  <FileText className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.title}</div>
                    <div className="text-[10px] text-muted-foreground">{a.kind} · open document</div>
                  </div>
                </button>
              ) : null
            }
          />
        </aside>
      </div>

      {openDoc && <DocumentViewer doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}

