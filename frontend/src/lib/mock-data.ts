export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  citations: number;
  relevance: number;
  abstract: string;
  tags: string[];
  doi: string;
  addedAt: string;
  status: "unread" | "reading" | "read";
  summary: {
    objective: string;
    methodology: string;
    dataset: string;
    results: string;
    limitations: string;
  };
  gaps: string[];
  future: string[];
  pdfUrl?: string;
};

const BASE: Paper[] = [
  {
    id: "arx-2411-01823",
    title: "Retrieval-Augmented Reasoning for Scientific Literature Synthesis",
    authors: ["A. Okafor", "M. Chen", "L. Petrova"],
    year: 2025,
    journal: "NeurIPS",
    citations: 412,
    relevance: 0.982,
    abstract:
      "We introduce RARS, a retrieval-augmented reasoning framework that combines dense passage retrieval with structured chain-of-thought verification to synthesize claims across large scientific corpora with 34% fewer hallucinations than baseline RAG.",
    tags: ["RAG", "Reasoning", "LLM"],
    doi: "10.48550/arXiv.2411.01823",
    addedAt: "2m ago",
    status: "reading",
    summary: {
      objective:
        "Reduce hallucination in multi-document scientific synthesis by grounding chain-of-thought steps in verified retrievals.",
      methodology:
        "Two-stage pipeline: dense retrieval over S2ORC embeddings, followed by claim-level verification using a critic model fine-tuned on 120k annotated examples.",
      dataset: "S2ORC (81M papers), SciFact, and a new benchmark SciSynth-5k.",
      results: "34% reduction in factual hallucinations vs. GPT-4 + RAG; F1 improved from 0.71 to 0.83.",
      limitations: "Retrieval latency scales linearly with corpus size; critic drifts on non-STEM fields.",
    },
    gaps: [
      "No evaluation on non-English scientific literature.",
      "Critic is not calibrated for retracted papers.",
    ],
    future: [
      "Extend to multilingual corpora.",
      "Integrate retraction-watch signals into the critic.",
    ],
  },
  {
    id: "arx-2409-11204",
    title: "SciAgent: Autonomous Agents for End-to-End Literature Review",
    authors: ["R. Balaji", "S. Nguyen"],
    year: 2024,
    journal: "ACL",
    citations: 289,
    relevance: 0.964,
    abstract:
      "SciAgent orchestrates search, extraction, and drafting sub-agents to produce publication-ready literature reviews with citation-verified paragraphs.",
    tags: ["Agents", "Literature Review"],
    doi: "10.48550/arXiv.2409.11204",
    addedAt: "1h ago",
    status: "unread",
    summary: {
      objective: "Automate the full literature review pipeline from query to draft.",
      methodology: "Multi-agent orchestration with planner, retrieval, extraction, and drafting agents.",
      dataset: "Custom LitReview-Bench of 1,200 human-written reviews across 8 domains.",
      results: "Human evaluators rated drafts within 0.4 points of PhD-authored reviews.",
      limitations: "High token cost per review (~$4.20); struggles with niche subfields.",
    },
    gaps: ["Weak handling of conflicting findings.", "No mechanism for pre-print confidence."],
    future: ["Add conflict-resolution reasoning.", "Integrate OpenReview signals."],
  },
  {
    id: "arx-2312-04001",
    title: "Dense Passage Retrieval Meets Citation Graphs",
    authors: ["Y. Tanaka", "F. Rossi", "K. Ahmed"],
    year: 2023,
    journal: "EMNLP",
    citations: 731,
    relevance: 0.941,
    abstract:
      "Fusing embedding similarity with citation-graph proximity yields consistent gains on scientific retrieval benchmarks.",
    tags: ["Retrieval", "Graph"],
    doi: "10.48550/arXiv.2312.04001",
    addedAt: "yesterday",
    status: "read",
    summary: {
      objective: "Improve semantic retrieval by injecting citation topology.",
      methodology: "Hybrid scoring combining SPECTER2 embeddings with personalized PageRank.",
      dataset: "SciDocs, TREC-COVID, CSFCube.",
      results: "nDCG@10 improved by 6.8 points over SPECTER2 alone.",
      limitations: "Requires fresh citation graph snapshots; cold-start for new pre-prints.",
    },
    gaps: ["No integration with author-level trust signals."],
    future: ["Incorporate author h-index and venue signals."],
  },
  {
    id: "arx-2506-00918",
    title: "Evaluating Hallucination in Scientific Summarization LLMs",
    authors: ["N. Weiss", "H. Park"],
    year: 2025,
    journal: "TACL",
    citations: 96,
    relevance: 0.918,
    abstract:
      "A rigorous benchmark for factuality of LLM-generated scientific summaries across biomedical, physics, and CS domains.",
    tags: ["Evaluation", "Hallucination"],
    doi: "10.48550/arXiv.2506.00918",
    addedAt: "3 days ago",
    status: "unread",
    summary: {
      objective: "Standardize evaluation of factual grounding in AI-generated scientific summaries.",
      methodology: "Annotated 8,400 model outputs by domain experts with atomic-fact decomposition.",
      dataset: "SciFact-Long, BioASQ, custom PhysSum-2k.",
      results: "Frontier LLMs fabricate 11–18% of atomic scientific claims in long summaries.",
      limitations: "Human annotation is expensive; not fully reproducible.",
    },
    gaps: ["No automated proxy metric correlates > 0.6 with expert judgement."],
    future: ["Design cheap proxy metrics via critic ensembles."],
  },
  {
    id: "arx-2201-09876",
    title: "SPECTER2: Scientific Document Embeddings at Scale",
    authors: ["J. Cohan", "K. Lo", "D. Weld"],
    year: 2022,
    journal: "AAAI",
    citations: 1843,
    relevance: 0.902,
    abstract:
      "SPECTER2 is a family of transformer encoders pre-trained on citation-linked scientific text, producing state-of-the-art embeddings for retrieval.",
    tags: ["Embeddings", "Foundation"],
    doi: "10.1609/aaai.v36i9.21285",
    addedAt: "1 week ago",
    status: "read",
    summary: {
      objective: "Provide open, task-agnostic embeddings for scientific documents.",
      methodology: "Contrastive pretraining on citation triplets with domain-adaptive negatives.",
      dataset: "S2ORC and citation triples mined from Semantic Scholar.",
      results: "New SOTA on 9 of 12 SciDocs tasks.",
      limitations: "English-only; encoder-only architecture limits generative use.",
    },
    gaps: ["No multilingual variant; no long-context variant."],
    future: ["Train multilingual SPECTER; extend context via longformer attention."],
  },
  {
    id: "arx-2408-15577",
    title: "Automated Discovery of Research Gaps in Machine Learning",
    authors: ["E. Marchetti", "T. Ilyas"],
    year: 2024,
    journal: "ICLR",
    citations: 174,
    relevance: 0.889,
    abstract:
      "A graph-based method to surface under-explored intersections of methods and problem domains across the ML literature.",
    tags: ["Discovery", "Graph"],
    doi: "10.48550/arXiv.2408.15577",
    addedAt: "2 weeks ago",
    status: "reading",
    summary: {
      objective: "Systematically identify white-space in the ML research landscape.",
      methodology: "Bipartite method-problem graph + community detection + rarity scoring.",
      dataset: "180k ML papers 2015–2024 from arXiv and OpenReview.",
      results: "Predicted 12 emerging gaps; 7 confirmed by experts.",
      limitations: "Domain-specific tagging; heavy manual curation.",
    },
    gaps: ["Limited to ML."],
    future: ["Cross-disciplinary gap mining."],
  },
];

// Expand to a scalable-looking library
const JOURNALS = ["NeurIPS", "ICML", "ICLR", "ACL", "EMNLP", "AAAI", "TACL", "Nature", "Science", "JMLR"];
const AUTHORS_POOL = [
  "L. Chen", "M. Rossi", "K. Ahmed", "T. Yamada", "P. Silva",
  "R. Novak", "S. Patel", "H. Park", "F. Dubois", "N. Weiss",
  "J. Cohan", "E. Marchetti", "Y. Tanaka", "A. Okafor",
];
const TITLE_TEMPLATES = [
  "Scaling laws for {topic} in scientific corpora",
  "Efficient {topic} with sparse attention",
  "A benchmark for {topic} across biomedical domains",
  "Rethinking {topic}: an empirical study",
  "{topic}: theory and practice",
  "On the limitations of {topic} at scale",
  "Foundation models for {topic}",
  "Zero-shot {topic} with contrastive objectives",
  "Interpretable {topic} via graph attention",
  "Robust {topic} under distribution shift",
];
const TOPICS = [
  "citation retrieval", "claim verification", "abstract generation", "entity linking",
  "long-context reasoning", "cross-lingual retrieval", "peer review", "figure understanding",
  "table extraction", "temporal reasoning", "knowledge grounding", "counterfactual synthesis",
];
const TAGS_POOL = ["RAG", "LLM", "Retrieval", "Graph", "Evaluation", "Agents", "Embeddings", "Benchmark", "Multimodal", "Reasoning"];

function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function makeExtra(i: number): Paper {
  const tpl = TITLE_TEMPLATES[i % TITLE_TEMPLATES.length];
  const topic = TOPICS[Math.floor(seeded(i) * TOPICS.length)];
  const title = tpl.replace("{topic}", topic);
  const year = 2019 + Math.floor(seeded(i + 1) * 8);
  const nAuthors = 2 + Math.floor(seeded(i + 2) * 3);
  const authors = Array.from({ length: nAuthors }, (_, k) =>
    AUTHORS_POOL[(i * 3 + k) % AUTHORS_POOL.length],
  );
  const nTags = 1 + Math.floor(seeded(i + 4) * 3);
  const tags = Array.from(new Set(Array.from({ length: nTags }, (_, k) =>
    TAGS_POOL[(i + k * 2) % TAGS_POOL.length],
  )));
  const citations = Math.floor(seeded(i + 5) * 1200);
  const relevance = 0.6 + seeded(i + 6) * 0.35;
  const status: Paper["status"] = ["unread", "reading", "read"][i % 3] as Paper["status"];
  const added = ["2m ago", "1h ago", "yesterday", "3 days ago", "1 week ago", "2 weeks ago", "1 month ago"][i % 7];
  return {
    id: `syn-${String(i).padStart(4, "0")}`,
    title,
    authors,
    year,
    journal: JOURNALS[i % JOURNALS.length],
    citations,
    relevance,
    abstract: `Study of ${topic}. We propose a method that improves over prior work by combining retrieval and verification steps, with empirical gains on standard benchmarks.`,
    tags,
    doi: `10.48550/arXiv.${2000 + (i % 999)}.${String(1000 + i).padStart(5, "0")}`,
    addedAt: added,
    status,
    summary: {
      objective: `Advance the state of ${topic}.`,
      methodology: "Hybrid retrieval with a critic verification stage.",
      dataset: "Standard scientific benchmarks (SciDocs, SciFact).",
      results: "Consistent gains over strong baselines.",
      limitations: "Domain adaptation and multilingual coverage remain open.",
    },
    gaps: ["Limited multilingual coverage."],
    future: ["Extend to under-represented domains."],
  };
}

export const MOCK_PAPERS: Paper[] = [
  ...BASE,
  ...Array.from({ length: 84 }, (_, i) => makeExtra(i)),
];

export type Project = {
  id: string;
  title: string;
  updated: string;
  papers: number;
  status: "Drafting" | "Review" | "Archived";
};

export const MOCK_PROJECTS: Project[] = [
  { id: "p1", title: "Hallucination-aware AI for scientific synthesis", updated: "2 min ago", papers: 6, status: "Drafting" },
  { id: "p2", title: "Autonomous agents for clinical trial design", updated: "yesterday", papers: 14, status: "Review" },
  { id: "p3", title: "Graph neural retrieval for legal precedent", updated: "3 days ago", papers: 22, status: "Archived" },
  { id: "p4", title: "Multimodal foundation models for radiology", updated: "1 week ago", papers: 31, status: "Review" },
];

export type ActivityEvent = {
  id: string;
  ts: string;
  kind: "index" | "retrieve" | "summarize" | "graph" | "critic";
  message: string;
};

export const SAMPLE_ACTIVITY: ActivityEvent[] = [
  { id: "1", ts: "just now", kind: "retrieve", message: "Indexed 12 new papers from your feed" },
  { id: "2", ts: "12s", kind: "summarize", message: "Summarized 3 papers in Reading list" },
  { id: "3", ts: "34s", kind: "critic", message: "Verified 47 atomic claims" },
];
