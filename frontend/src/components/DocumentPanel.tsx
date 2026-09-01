import { useState } from "react";
import {
  FileText,
  X,
  Download,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
  Check,
  Copy,
  Printer,
  Code,
  FileCode,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Doc } from "@/lib/documents";
import { downloadText, slugify, toLaTeX, toPrintableHTML } from "@/lib/download";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DocumentList({
  docs,
  onOpen,
  onRemove,
}: {
  docs: Doc[];
  onOpen: (d: Doc) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="card-3d overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Documents
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{docs.length}</span>
      </div>
      {docs.length === 0 ? (
        <div className="px-6 py-8 text-center text-xs text-muted-foreground">
          No documents yet. In the agent chat, hit{" "}
          <span className="rounded border border-border bg-background px-1 py-0.5 font-mono">
            +
          </span>{" "}
          → <span className="text-accent">Generate document</span>.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <FileText className="h-4 w-4" />
              </div>
              <button onClick={() => onOpen(d)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium group-hover:text-accent">
                  {d.title}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border px-1.5 py-0">{d.kind}</span>
                  {d.status === "pending" || d.status === "processing" ? (
                    <span className="inline-flex items-center gap-1 text-accent">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Generating…
                    </span>
                  ) : d.status === "failed" ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-2.5 w-2.5" /> Failed
                    </span>
                  ) : (
                    <span>{d.words.toLocaleString()} words</span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
              <button
                onClick={() => onRemove(d.id)}
                aria-label="Delete document"
                className="btn-pop rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocumentViewer({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="card-3d mt-8 flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card animate-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{doc.title}</div>
            <div className="text-[11px] text-muted-foreground">
              {doc.kind} · {doc.words.toLocaleString()} words
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={doc.status !== "done"}
                className="btn-pop inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent hover:text-accent disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Document Formats
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  downloadText(`${slugify(doc.title)}.md`, doc.content, "text/markdown")
                }
                className="cursor-pointer gap-2"
              >
                <FileText className="h-3.5 w-3.5 text-accent" />
                <span>Markdown (.md)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  downloadText(
                    `${slugify(doc.title)}.tex`,
                    toLaTeX(doc.title, doc.content),
                    "text/x-tex",
                  )
                }
                className="cursor-pointer gap-2"
              >
                <Code className="h-3.5 w-3.5 text-indigo-500" />
                <span>LaTeX Source (.tex)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => downloadText(`${slugify(doc.title)}.txt`, doc.content, "text/plain")}
                className="cursor-pointer gap-2"
              >
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Plain Text (.txt)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const html = toPrintableHTML(doc.title, doc.content);
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(html);
                    w.document.close();
                  }
                }}
                className="cursor-pointer gap-2"
              >
                <Printer className="h-3.5 w-3.5 text-emerald-500" />
                <span>Print / Save to PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(doc.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            className="btn-pop inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-pop rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="agent-md overflow-y-auto px-8 py-6 text-[14px] leading-relaxed">
          {doc.status === "pending" || doc.status === "processing" ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <p className="text-sm">
                Still generating in the background — this document will keep going even if you close
                this window. Reopen it anytime to check back.
              </p>
            </div>
          ) : doc.status === "failed" ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">Generation failed{doc.error ? `: ${doc.error}` : "."}</p>
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
