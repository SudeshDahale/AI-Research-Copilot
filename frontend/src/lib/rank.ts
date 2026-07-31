import type { Paper } from "@/lib/mock-data";

const STOP = new Set([
  "the","a","an","of","in","on","for","and","or","to","with","using","via","how","what",
  "is","are","be","by","at","from","about","research","paper","papers","study","studies",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Cosine-ish lexical similarity between a query and a paper, 0..1. */
export function similarity(query: string, paper: Paper): number {
  const q = tokenize(query);
  if (!q.length) return 0;
  const title = tokenize(paper.title);
  const abs = tokenize(paper.abstract);
  const tags = paper.tags.map((t) => t.toLowerCase());

  let score = 0;
  for (const term of new Set(q)) {
    if (tags.some((t) => t.includes(term) || term.includes(t))) score += 3;
    if (title.some((w) => w.includes(term) || term.includes(w))) score += 2.5;
    if (abs.some((w) => w === term)) score += 1;
  }
  const max = new Set(q).size * 6.5;
  const lexical = Math.min(1, score / max);
  // blend with intrinsic quality signals so ranking is never flat
  const recency = Math.min(1, Math.max(0, (paper.year - 2018) / 8));
  const impact = Math.min(1, Math.log10(paper.citations + 1) / 3.5);
  return Math.min(0.99, lexical * 0.72 + recency * 0.13 + impact * 0.15);
}

export type Ranked = Paper & { score: number };

export function rankPapers(query: string, papers: Paper[]): Ranked[] {
  return papers
    .map((p) => ({ ...p, score: similarity(query, p) }))
    .sort((a, b) => b.score - a.score);
}
