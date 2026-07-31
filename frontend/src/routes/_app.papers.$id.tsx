import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, ExternalLink, ArrowRight } from "lucide-react";
import { MOCK_PAPERS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/papers/$id")({
  loader: ({ params }) => {
    const paper = MOCK_PAPERS.find((p) => p.id === params.id);
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
  const related = MOCK_PAPERS.filter((p) => p.id !== paper.id).slice(0, 4);

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-6 py-8 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <Link
          to="/library"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {/* Hero */}
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{paper.journal}</span>
            <span>·</span>
            <span>{paper.year}</span>
            <span>·</span>
            <span>{paper.citations.toLocaleString()} citations</span>
            <span>·</span>
            <span className="font-mono">{paper.doi}</span>
          </div>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{paper.title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{paper.authors.join(", ")}</div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/review">
              <Button size="sm">Add to review <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </Link>
            <Button size="sm" variant="outline"><Bookmark className="mr-1 h-3.5 w-3.5" /> Save</Button>
            <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Open PDF</Button>
          </div>
        </div>

        {/* Structured summary */}
        <div className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI summary
          </h2>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            {SECTIONS.map((s) => (
              <div key={s.key} className="grid grid-cols-[100px_1fr] gap-4 py-3">
                <dt className="text-sm font-medium text-foreground/70">{s.label}</dt>
                <dd className="text-sm leading-relaxed text-foreground/90">
                  {paper.summary[s.key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Gaps & Future */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
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
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Related</h3>
        <ul className="mt-3 space-y-3">
          {related.map((r) => (
            <li key={r.id}>
              <Link
                to="/papers/$id"
                params={{ id: r.id }}
                className="group block"
              >
                <div className="text-xs text-muted-foreground">
                  {r.journal} · {r.year}
                </div>
                <div className="line-clamp-2 text-sm text-foreground group-hover:text-accent">
                  {r.title}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
