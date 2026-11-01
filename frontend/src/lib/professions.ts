export interface ProfessionInfo {
  id: string;
  label: string;
  category: string;
  badge: string;
  tagline: string;
  experienceDescription: string;
  focusAreas: string[];
  recommendedWorkflows: string[];
  icon: "GraduationCap" | "BookOpen" | "Cpu" | "Activity" | "Sparkles" | "Lightbulb";
}

export const PROFESSIONS: ProfessionInfo[] = [
  {
    id: "academic_researcher",
    label: "Academic Researcher / Faculty",
    category: "Academia",
    badge: "Academic Researcher",
    tagline: "Methodology rigor, citations & peer review",
    experienceDescription:
      "Tailored for comprehensive literature synthesis, methodology validation, cross-paper citation analysis, and peer-review preparation.",
    focusAreas: ["Systematic Review", "Methodology Comparison", "Empirical Claims & Proofs"],
    recommendedWorkflows: ["Literature Synthesis", "Methodology Matrix", "Citation Graph"],
    icon: "GraduationCap",
  },
  {
    id: "phd_student",
    label: "PhD / Graduate Student",
    category: "Graduate Research",
    badge: "PhD Candidate",
    tagline: "Thesis foundations, seminal work & research gaps",
    experienceDescription:
      "Optimized for discovering open research questions, tracing seminal foundations, and drafting dissertation literature reviews.",
    focusAreas: ["Research Gap Discovery", "Seminal Foundations", "Related Work Mapping"],
    recommendedWorkflows: ["Gap Analysis", "Foundational Paper Trace", "Thesis Chapters"],
    icon: "BookOpen",
  },
  {
    id: "industry_rd",
    label: "Industry R&D / Engineer",
    category: "Industry",
    badge: "Industry R&D",
    tagline: "Applied SOTA, benchmarks & tech transfer",
    experienceDescription:
      "Prioritizes empirical benchmarks, implementation feasibility, latency/throughput trade-offs, and practical architecture.",
    focusAreas: ["SOTA Benchmarks", "Implementation Feasibility", "System Trade-offs"],
    recommendedWorkflows: ["Benchmark Audit", "Tech Transfer Brief", "Architecture Review"],
    icon: "Cpu",
  },
  {
    id: "medical_clinical",
    label: "Medical & Clinical Scientist",
    category: "Healthcare",
    badge: "Clinical Scientist",
    tagline: "Clinical trials, meta-analyses & evidence synthesis",
    experienceDescription:
      "Structured for biomedical evidence synthesis, clinical trial outcomes, cohort statistics, and evidence-based medicine.",
    focusAreas: ["Clinical Evidence", "Meta-Analyses", "Cohort & Trial Outcomes"],
    recommendedWorkflows: ["Evidence Synthesis", "Clinical Trial Matrix", "Safety & Efficacy"],
    icon: "Activity",
  },
  {
    id: "data_ml",
    label: "Data Scientist / ML Engineer",
    category: "Data & AI",
    badge: "ML Practitioner",
    tagline: "Model architectures, training dynamics & datasets",
    experienceDescription:
      "Geared towards model architectures, loss formulations, training dynamics, dataset curation, and reproducible metrics.",
    focusAreas: ["Model Architectures", "Loss & Training Dynamics", "Dataset Evaluation"],
    recommendedWorkflows: ["Architecture Deep-Dive", "Dataset Audit", "Reproducibility Check"],
    icon: "Sparkles",
  },
  {
    id: "student_learner",
    label: "Student & Independent Learner",
    category: "Learning",
    badge: "Learner",
    tagline: "Conceptual clarity & accessible breakdowns",
    experienceDescription:
      "Formats complex papers into accessible explanations, highlighting core intuition, novel contributions, and foundational concepts.",
    focusAreas: ["Core Concept Breakdowns", "Intuitive Summaries", "Prerequisite Knowledge"],
    recommendedWorkflows: ["Concept Explainer", "Paper Highlights", "Prerequisite Guide"],
    icon: "Lightbulb",
  },
];

export function getProfessionInfo(professionOrBadge?: string | null): ProfessionInfo {
  if (!professionOrBadge) return PROFESSIONS[0];
  const normalized = professionOrBadge.toLowerCase().trim();
  const found = PROFESSIONS.find(
    (p) =>
      p.id.toLowerCase() === normalized ||
      p.label.toLowerCase() === normalized ||
      p.badge.toLowerCase() === normalized,
  );
  if (found) return found;

  return {
    id: "custom",
    label: professionOrBadge,
    category: "Custom",
    badge: professionOrBadge,
    tagline: "Personalized research copilot",
    experienceDescription: `Personalized AI copilot workflows configured for ${professionOrBadge}.`,
    focusAreas: ["Literature Search", "Synthesis", "Paper Q&A"],
    recommendedWorkflows: ["Workspace Synthesis", "Comparative Analysis"],
    icon: "Sparkles",
  };
}

