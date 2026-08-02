# Arclight — Backend Implementation Plan

**Stack:** FastAPI (Python) · PostgreSQL + pgvector · Redis + Celery · LangGraph · Real LLM API
**Goal:** Turn the already-scaffolded (but empty) `backend/app/` files into a working backend, one vertical slice at a time, replacing the client-side `localStorage`/template-string "AI" in `frontend/src/lib/` with the real thing.

This follows the same approach as the AutoScribe plan: every sprint ends with something that was fake in the UI becoming real, sized for part-time learning, with the concept explained before the task.

## What you're actually building

Reading the frontend, Arclight is: search papers across external sources → save to a workspace → get AI analysis per paper (summary/gaps/future work) → run an agent that can answer questions, spin up a workspace, or generate a document (lit review/summary/report) → review and export generated documents.

Right now **none of that is real** — `MOCK_PAPERS` is hardcoded, `lib/workspaces.ts` and `lib/documents.ts` persist to `localStorage`, `lib/agent.ts`'s `buildAgentReply` is string templating (not an LLM call), and `lib/agent-plan.ts`'s step arrays (`searchSteps`, `documentSteps`, etc.) are `setTimeout`-simulated progress, not a real pipeline.

| Frontend fake | Backend file (already stubbed, empty) | Sprint |
|---|---|---|
| `lib/session.ts` (localStorage session) | `app/core/security.py`, `app/api/v1/auth.py` | 1 |
| `lib/workspaces.ts` (localStorage) | `app/models/workspace.py`, `app/services/workspace_service.py`, `app/api/v1/workspaces.py` | 2 |
| `MOCK_PAPERS` in `mock-data.ts` | `app/services/paper_service.py`, `app/api/v1/search.py` | 3 |
| `lib/rank.ts` lexical scoring | `app/services/ranking_service.py` | 3–6 |
| paper `summary`/`gaps`/`future` fields | `app/services/llm_service.py` | 5 |
| — (no equivalent yet) | `app/services/vector_service.py` | 6 |
| `lib/agent.ts` + `lib/agent-plan.ts` | `app/agents/graph.py`, `app/agents/state.py`, `app/agents/nodes/*.py`, `app/agents/prompts/*.py`, `app/api/v1/agent.py` | 7 |
| `lib/documents.ts` (localStorage) | `app/models/document.py`, `app/services/document_service.py`, `app/workers/generate_document.py`, `app/api/v1/documents.py` | 8 |

---

## Sprint 0 — Wake up the skeleton

**You'll learn:** FastAPI app structure, `pydantic-settings`, the SQLAlchemy session pattern, why config/DB/logging are set up before any feature code.

**Build:**
- `app/config.py` — a `Settings(BaseSettings)` class reading `.env` (DB URL, Redis URL, LLM API key, JWT secret)
- `app/db/session.py` — SQLAlchemy async engine + `get_db()` dependency
- `app/core/logging.py` — basic structured logging setup
- `app/main.py` — FastAPI app, CORS for the Vite dev server, includes `app/api/v1/router.py`
- Fill `infra/docker-compose.yml`: `postgres` (with the `pgvector` image, you'll need it in Sprint 6 — easier to start with it than migrate later), `redis`, `backend`
- Point the frontend's Vite dev proxy at the backend so it never hardcodes a URL

**Definition of done:** `docker compose up` brings up Postgres + Redis; `GET /api/v1/healthz` (add this route) returns 200 through the frontend's dev proxy.

---

## Sprint 1 — Real accounts, replacing `lib/session.ts`

**You'll learn:** Password hashing, JWT issuance/verification, and why the current "auth" (an object in `localStorage`) isn't auth at all — anyone can open devtools and set `mode: "user"`.

**Build:**
- `app/models/user.py` — SQLAlchemy model
- Alembic migration
- `app/core/security.py` — `hash_password`/`verify_password` (passlib/bcrypt), `create_access_token`/`decode_token` (JWT)
- `app/api/v1/auth.py` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `app/dependencies.py` — `get_current_user` dependency used by every protected route from here on

**Frontend wiring:** Replace `getSession`/`setSession`/`clearSession` in `lib/session.ts` with real calls and store only the JWT (httpOnly cookie or, if you must, memory + refresh — avoid `localStorage` for the token itself).

**Definition of done:** You can register, log in, refresh the page, and still be logged in — because a real server verified a real token, not because an object survived in `localStorage`.

---

## Sprint 2 — Workspaces & the paper library, replacing `lib/workspaces.ts`

**You'll learn:** Many-to-many relationships (a paper can be in multiple workspaces, per `paperIds: string[]`), and separating "route handles HTTP" from "service holds business logic" — the `workspace_service.py` file already implies this split, this sprint is where you learn *why* it's split.

**Build:**
- `app/models/workspace.py` — `Workspace` + a `workspace_papers` association table
- `app/schemas/workspace.py` — Pydantic request/response models
- `app/services/workspace_service.py` — create/rename/delete, add/remove papers
- `app/api/v1/workspaces.py` — CRUD routes, owned by the current user

**Frontend wiring:** `useWorkspaces()` in `lib/workspaces.ts` — replace the `read()`/`write()` localStorage pair with React Query hooks hitting these endpoints. `_app.library.tsx` should now show workspaces that survive a browser restart.

**Definition of done:** Two different browsers logged in as the same account see the same workspaces. (Try it — this is the moment "it's not just local state anymore" becomes real.)

---

## Sprint 3 — Real paper search, replacing `MOCK_PAPERS`

**You'll learn:** Calling multiple external REST APIs concurrently (`httpx` + `asyncio.gather`), and normalizing inconsistent third-party response shapes into one internal type.

**Build:**
- `app/services/paper_service.py`:
  - arXiv (no key needed — good first integration, XML response though, so you'll parse that)
  - Semantic Scholar API (free tier, JSON, gives you citation counts for free)
  - Optionally OpenAlex (also free, broadest coverage)
  - Normalize all three into the `Paper` shape your frontend already expects (`lib/mock-data.ts`'s `Paper` type is your target schema)
  - Dedupe by DOI, falling back to fuzzy title match for preprints without one
- `app/services/ranking_service.py` — port `lib/rank.ts`'s lexical `similarity()` function server-side (you have the logic already, in TypeScript — translating it to Python is a good exercise in reading your own code critically, not blindly)
- `app/api/v1/search.py` — `POST /search` returning ranked, deduped results

**Frontend wiring:** `_app.search.tsx` — replace `rankPapers(query, MOCK_PAPERS)` with a real API call.

**Definition of done:** Searching "retrieval augmented generation" returns real, current papers from arXiv — not the 90 hardcoded ones.

**Go deeper:** Why XML parsing (arXiv) and JSON parsing (Semantic Scholar) need genuinely different error handling — a malformed XML response fails differently than a malformed JSON one.

---

## Sprint 4 — Caching, and persisting papers you actually save

**You'll learn:** Why you cache third-party API calls (rate limits, latency, cost — even free APIs throttle you), and the difference between "ephemeral search result" and "a paper I saved" as two different lifetimes for the same data.

**Build:**
- `app/core/cache.py` — a Redis-backed cache decorator/helper, applied to the search calls from Sprint 3 (cache by query string, short TTL)
- `app/models/paper.py` — persist a paper row *only* when a user adds it to a workspace (search results stay ephemeral/cached; saved papers become durable rows)
- Update `workspace_service.py`'s "add paper" to upsert into `papers` before linking

**Definition of done:** Searching the same query twice in a row is visibly faster (check the logs — second call should skip the external API entirely). A paper you've added to a workspace still has an `/api/v1/papers/{id}` you can hit even if it's fallen out of any search cache.

---

## Sprint 5 — AI paper analysis, replacing the hardcoded `summary`/`gaps`/`future`

**You'll learn:** Structured LLM output (again — you'll get much faster at this the second time), and running LLM calls as background work instead of blocking a request.

**Build:**
- `app/services/llm_service.py` — thin client wrapper + a `generate_structured()` helper (tool-calling / JSON schema, not "please respond in JSON")
- A new route (add `app/api/v1/papers.py` — the skeleton doesn't have one yet, and that's fine, real projects grow past their initial file list) — `POST /papers/{id}/analyze`, given the paper's abstract (+ metadata), returns the `objective/methodology/dataset/results/limitations` summary plus `gaps` and `future` arrays, matching the shape already in `mock-data.ts`'s `Paper.summary`
- Run this via Celery (you'll want the queue working before Sprint 7-8 anyway) rather than inline in the request

**Frontend wiring:** `_app.papers.$id.tsx` — trigger analysis on first view (or on save-to-workspace), show a loading state while the Celery task runs, then real AI-generated content instead of the mock's canned summary.

**Definition of done:** Two papers with genuinely different abstracts produce genuinely different summaries — not a templated fill-in-the-blank like `buildAgentReply` currently does.

---

## Sprint 6 — Embeddings & semantic search

**You'll learn:** Vector embeddings, `pgvector`, and blending semantic similarity with the lexical + recency + citation signals you already have (this is exactly the ranking formula the pre-existing `implementation plan.md` sketches — now you're building it for real).

**Build:**
- `app/services/vector_service.py` — embed paper abstracts (embeddings API call), store in a `pgvector` column
- Extend `ranking_service.py`: blend semantic similarity with recency and citation count (weights are a judgment call — start with something close to `lib/rank.ts`'s existing blend and tune from there)
- A "similar papers" endpoint using vector distance — this is your first taste of retrieval, which you'll reuse directly in Sprint 7's agent

**Definition of done:** A "find similar papers" action on a paper detail page returns genuinely topically-related papers, not just same-author or same-journal matches.

**Go deeper:** Why cosine distance is the usual choice for text embeddings specifically (they're roughly unit-normalized by construction in most embedding models) — worth understanding once, not memorizing.

---

## Sprint 7 — The agent, replacing `lib/agent.ts` + `lib/agent-plan.ts`

**You'll learn:** LangGraph — nodes, shared state, conditional routing — and streaming step-by-step progress over SSE. This is the biggest sprint; the six earlier sprints exist specifically to make this one tractable, since every node you write here just orchestrates a service you already built.

**Build:**
- `app/agents/state.py` — a `TypedDict` (or LangGraph `State`) carrying: the query, detected intent, papers in scope, accumulated results
- `app/agents/nodes/*.py` — each existing stub file becomes one graph node:
  - `search_node.py` → calls Sprint 3's `paper_service`
  - `ranking_node.py` → calls Sprint 6's `ranking_service`
  - `summarize_node.py` → calls Sprint 5's `llm_service`
  - `clustering_node.py` → groups papers by theme (start with a simple embedding-distance clustering, e.g. k-means over the Sprint 6 vectors)
  - `gap_detection_node.py` → prompts the LLM with clustered themes + limitations text to surface actual gaps (replacing the hardcoded gap text in `buildAgentReply`)
  - `lit_review_node.py` → drafts the narrative, reusing Sprint 5's structured-output pattern
- `app/agents/graph.py` — wire nodes into a `StateGraph`, with conditional routing that mirrors `detectIntent()` in `lib/agent-plan.ts` (`workspace` / `document` / `answer` as three paths through the graph)
- `app/agents/prompts/*.py` — the actual prompt text for each node (keep prompts in their own files, not inlined — you'll thank yourself when you're iterating on wording without redeploying)
- `app/api/v1/agent.py` — `POST /agent/run` streaming progress via SSE, one event per node transition

**Frontend wiring:** `_app.workflow.$id.tsx` and `_app.workflow.index.tsx` — replace the `setTimeout`-driven fake steps (`searchSteps`, `workspaceSteps`, `documentSteps`, `answerSteps` in `lib/agent-plan.ts`) with real SSE events from the graph. The step *labels* you already have are a genuinely good UI spec — keep them, just drive them from real node transitions instead of a timer.

**Definition of done:** Asking the agent "find research gaps in my workspace" runs a real multi-step graph against real papers and produces a gap report grounded in what's actually in that workspace — not the fixed four bullet points `buildAgentReply` currently returns for every workspace.

---

## Sprint 8 — Document generation & persistence, replacing `lib/documents.ts`

**You'll learn:** Long-running LLM pipelines as queued jobs with a durable status you can poll or stream, and treating generated content as versioned data rather than a one-shot string.

**Build:**
- `app/models/document.py` — matches `Doc` in `lib/documents.ts` (`workspace_id`, `title`, `kind`, `prompt`, `content`)
- `app/services/document_service.py` — create/list/delete, scoped to workspace
- `app/workers/generate_document.py` — the Celery task: runs the Sprint 7 agent graph's "document" path, writes the result to `documents` when done
- `app/api/v1/documents.py` — `POST /documents` (enqueues), `GET /documents/{id}` (poll status), `GET /workspaces/{id}/documents` (list)

**Frontend wiring:** `_app.review.tsx` — replace `useDocuments()`'s localStorage read/write with real API calls; "Export PDF" now exports a real generated document instead of whatever's sitting in `localStorage`.

**Definition of done:** Generating a literature review, closing the tab mid-generation, and reopening it later shows the finished document — because it lived in Postgres and a worker the whole time, not in the tab's memory.

---

## Sprint 9 — Auth hardening & ownership

**You'll learn:** Resource-level authorization — every workspace, paper, and document needs an owner check, not just a "logged in" check.

**Build:**
- Ownership checks on every `/workspaces/{id}`, `/documents/{id}` route
- Rate limiting on `/search` and `/agent/run` specifically (these are your expensive endpoints — external API calls and LLM calls respectively)

**Definition of done:** A second test account can't see or touch the first account's workspaces via direct API calls, even knowing the IDs.

---

## Sprint 10 — Testing, observability, deployment

**You'll learn:** Testing FastAPI with a test database, and taking the already-present (empty) `infra/k8s/*.yaml` and `.github/workflows/ci.yml` from placeholders to something real.

**Build:**
- Fill `backend/tests/unit/` and `backend/tests/integration/` (both exist, both empty) — start with the service-layer functions from Sprints 2–6, they're the most testable since they don't need a live LLM call in the loop (mock the LLM client)
- Fill `.github/workflows/ci.yml` — lint, test, build on push
- Fill `backend/Dockerfile` and `infra/docker-compose.yml` for the full stack (frontend + backend + worker + Postgres + Redis)
- `infra/k8s/*.yaml` is a stretch goal, not required to demo the project — Docker Compose alone is enough to show it working end to end. Only reach for Kubernetes once Compose feels genuinely limiting, not because the folder already exists.

**Definition of done:** `docker compose up` runs the whole stack from a clean checkout; CI is green; you can demo: search real papers → save to a workspace → get real AI analysis → run the agent to generate a real literature review → export it.

---

## Suggested order

Sprints 0–3 are sequential and non-negotiable — nothing works without accounts, workspaces, and real papers. 4 (caching) can be done in parallel with or even after 5 if you're impatient to see AI analysis working — it's a performance concern, not a correctness one. 5→6→7→8 is the real spine of the app and should stay in order, since Sprint 7's agent is *only* orchestration of services built in 3, 5, and 6. 9–10 are cleanup and can be interleaved with whichever earlier sprint you're least confident in, as a chance to revisit it with fresh eyes.
