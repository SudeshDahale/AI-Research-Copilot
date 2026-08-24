import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, ExternalLink, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { type Paper } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getCachedPapers, cachePapers, searchCachedPapers } from "@/lib/paper-cache";

export const Route = createFileRoute("/_app/papers/$id")({
  loader: async ({ params }) => {
    let paper = getCachedPapers([params.id])[0];
    if (!paper) {
      try {
        const raw = await apiFetch<any>(`/papers/${params.id}`);
        paper = {
          ...raw,
          score: raw.relevance ?? 0.0,
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
  const [similarPapers, setSimilarPapers] = useState<(Paper & { score?: number; isVector?: boolean })[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSimilar() {
      try {
        const data = await apiFetch<any[]>(`/papers/${paper.id}/similar?limit=4`);
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
        // Expected when paper or library is not yet embedded in vector DB
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
          <div className="mt-2 text-sm text-muted-foreground">{(paper.authors || []).join(", ")}</div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/review">
              <Button size="sm">Add to review <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </Link>
            <Button size="sm" variant="outline"><Bookmark className="mr-1 h-3.5 w-3.5" /> Save</Button>
            {paper.pdfUrl ? (
              <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Open PDF</Button>
              </a>
            ) : (
              <Button size="sm" variant="outline" disabled title="No PDF available"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Open PDF</Button>
            )}
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
                const val = (paper.summary as any)?.[s.key];
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
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gaps</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {paper.gaps.map((g: string) => (
                    <li key={g} className="flex gap-2 text-foreground/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {paper.future && paper.future.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Future work</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {paper.future.map((f: string) => (
                    <li key={f} className="flex gap-2 text-foreground/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />{f}
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
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Similar papers</h3>
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
              <li key={r.id} className="rounded-lg border border-border bg-card/60 p-2.5 transition hover:border-accent/40">
                <Link
                  to="/papers/$id"
                  params={{ id: r.id }}
                  className="group block"
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{r.journal || "ArXiv"} · {r.year}</span>
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
