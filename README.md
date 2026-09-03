# Arclight

![Arclight Banner](assets/cover.png)

An AI-powered research copilot for discovering, curating, and analyzing scientific papers with vector similarity search and a multi-agent research engine.

---

## Overview

**Arclight** is a full-stack research assistant that lets you search millions of scientific papers from arXiv and Semantic Scholar, organize them into workspaces, run vector-based similarity searches via `pgvector`, and converse with a LangGraph-powered research agent scoped to your curated collections — complete with real-time streaming, background document generation, and production deployment manifests.

---

## Features (Through Sprint 10 — Complete)

### 1. Paper Discovery & Search
- Full-text search querying live **arXiv** and **Semantic Scholar** APIs.
- Results are **normalized**, **deduplicated** (by DOI, arXiv ID, or fuzzy title match), and **ranked** by lexical query relevance.
- Filter results by year range, citation count, venue, and topic tags.
- **Discover Chat Assistant**: Lightweight AI chat (`POST /api/v1/discover/chat`) that narrows candidate papers via `top_n` selection, NLP-based filter extraction, or an instant re-query — before you commit them to a workspace.
- Open-access PDF links (`pdf_url`) allow directly opening original papers in a new tab.

### 2. Redis Caching & Durable Persistence
- **Fast Search Caching**: Redis-backed caching with automatic TTL (`cache.py`) avoids redundant external API queries for repeated searches.
- **Two-Tier Lifetime**: Search results remain fast and ephemeral in Redis, while papers saved to workspaces are durably upserted into PostgreSQL (`papers` table).
- Durable paper lookup endpoint: `GET /api/v1/papers/{id}`.

### 3. Vector Embeddings & `pgvector` Semantic Similarity
- **Voyage AI Embeddings**: Generates 512-dimensional vector embeddings using the `voyage-3.5-lite` scientific model.
- **PostgreSQL `pgvector`**: High-performance nearest-neighbor cosine similarity search using HNSW indexing (`vector_cosine_ops`).
- **Find Similar Papers**: `GET /api/v1/papers/{id}/similar` returns topically related papers based on deep semantic meaning.

### 4. LangGraph Research Agent — Dual-Pipeline Architecture
- **Fast Pipeline**: streams a synthesized, directly-formatted answer to the user within 1–2 seconds via token streaming, using a context-distillation layer with strict token budgeting.
- **Deep Pipeline**: runs in parallel against the same in-memory papers (no re-retrieval), dispatching to an intent-specific analysis node — `summary`, `gaps`, `compare`, `contradictions`, or `literature_review` — chosen by `router.detect_intent()`.
- Single LangGraph state machine (`retrieve → [intent node] → compose`) backs the deep pipeline: `app/agents/graph.py`.
- Real-time Server-Sent Events endpoint: `POST /api/v1/agent/run`, scoped to a workspace's saved papers.

### 5. Automated Document Generation
- Generate long-form deliverables — **Report, Literature review, Summary, Outline, or Brief** — from a workspace's papers via `POST /api/v1/documents`.
- Jobs run on a **Celery** background worker (with automatic in-process fallback if Redis is offline), and are persisted to PostgreSQL for durable polling (`GET /api/v1/documents/{id}`).
- Workspace-scoped document list, review, and export UI in the frontend (`/review` route).

### 6. Authentication & Workspaces
- JWT authentication with secure bcrypt password hashing.
- Workspace CRUD operations with PostgreSQL persistence and per-resource ownership isolation.
- Per-workspace paper curation and scoped agent/document generation.

### 7. Hardening, Testing & Deployment
- Strict resource-level authorization checks across all workspace and document endpoints.
- Sliding-window rate limiting on `/search` and `/agent/run`.
- Unit tests (agent graph, auth ownership, discover intent, search optimizations) and a full end-to-end integration test suite (`backend/tests/`).
- GitHub Actions CI pipeline (`.github/workflows/ci.yml`), full-stack Docker Compose orchestration, and Kubernetes production manifests (`infra/k8s/`).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19 · TypeScript 5.8 · Vite 8 · TanStack Router · TanStack Query |
| **Backend** | FastAPI · SQLAlchemy 2.0 (Async) · Pydantic Settings · Alembic |
| **Agent Orchestration** | LangGraph (dual fast/deep pipeline, intent-routed analysis nodes) |
| **Database & Vectors** | PostgreSQL 15+ · `pgvector` (HNSW indexing) |
| **Embeddings** | Voyage AI (`voyage-3.5-lite`, 512-dim) |
| **Cache / Broker** | Redis |
| **Background Jobs** | Celery |
| **External APIs** | arXiv Atom Feed · Semantic Scholar Graph API |
| **Deployment** | Docker Compose · Kubernetes (Deployments, Services, Ingress) · GitHub Actions CI |

---

## How to Run Locally

### Prerequisites
- **Python 3.11 or 3.12**
- **Node.js 18+** and npm
- **PostgreSQL** running locally with database `arclight` and the `vector` extension enabled
- **Redis** running locally (or via WSL: `redis-server`)

---

### 1. Configure the Backend Environment
Create or update `backend/.env` (or copy `backend/.env.example`):

```env
# --- App ---
APP_NAME=Arclight
ENVIRONMENT=development
DEBUG=true

# --- Database ---
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/arclight

# --- Redis / Celery ---
REDIS_URL=redis://localhost:6379/0

# --- Auth ---
JWT_SECRET=change-me-to-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# --- LLM ---
LLM_API_KEY=

# --- Embeddings ---
VOYAGE_API_KEY=your-voyage-api-key
EMBEDDING_MODEL=voyage-3.5-lite
EMBEDDING_DIM=512

# --- CORS ---
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

### 2. Quickstart with Docker Compose (Recommended)
You can run the entire full-stack system (Frontend + Backend + Celery Worker + PostgreSQL/pgvector + Redis) with a single command:

```bash
# Start all 5 services
docker compose up --build -d

# View service logs
docker compose logs -f
```

- **Frontend Application**: `http://localhost:8080`
- **Backend API Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/v1/healthz`

---

### 3. Local Manual Development Setup

#### Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Mac/Linux

# Install dependencies
pip install -e ".[dev]"

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --port 8000 --reload
```

- **API base**: `http://localhost:8000/api/v1`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`
- **Health check**: `http://localhost:8000/api/v1/healthz`

#### Celery Background Worker
```bash
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

- **Frontend Application**: `http://localhost:8080`

#### Running Tests
```bash
cd backend
pytest tests/unit           # Unit tests
pytest tests/integration    # Full end-to-end workflow tests
```

---

## Project Structure

```
AI-Research-Copilot/
├── .github/
│   └── workflows/
│       └── ci.yml              # Automated GitHub Actions test & build pipeline
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py         # JWT register & login
│   │   │   ├── search.py       # Cached & rate-limited multi-source paper search
│   │   │   ├── workspaces.py   # Workspaces CRUD, ownership isolation, & paper linking
│   │   │   ├── documents.py    # Document generation jobs & durable polling
│   │   │   ├── agent.py        # Real-time SSE dual-pipeline research agent
│   │   │   ├── discover.py     # Discover-page filtering/narrowing chat
│   │   │   ├── papers.py       # Durable paper lookup & pgvector similarity
│   │   │   └── router.py       # Main API router & healthcheck
│   │   ├── agents/
│   │   │   ├── graph.py            # LangGraph state machine: retrieve → intent node → compose
│   │   │   ├── fast_pipeline.py    # Streaming "UX engine" — instant synthesized answers
│   │   │   ├── deep_pipeline.py    # In-memory intent-specific analysis (summary/gaps/compare/...)
│   │   │   ├── discover_router.py  # Intent detection for the Discover chat
│   │   │   ├── distillation.py     # Context distillation & token budgeting
│   │   │   └── nodes/              # summary, gaps, compare, contradiction, review, compose nodes
│   │   ├── services/           # Paper search/ranking, vector, LLM, document, workspace services
│   │   ├── core/
│   │   │   ├── cache.py        # Redis async client & search cache helpers
│   │   │   ├── rate_limit.py   # Sliding-window rate limiter
│   │   │   ├── security.py     # JWT & password hashing
│   │   │   └── logging.py      # Structured application logger
│   │   ├── workers/            # Celery background workers (generate_document)
│   │   └── models/             # SQLAlchemy ORM models (User, Workspace, Paper, Document)
│   ├── tests/
│   │   ├── unit/               # Unit tests (agent, auth, discover, search optimizations)
│   │   └── integration/        # End-to-end full workflow integration tests
│   └── Dockerfile              # Backend container definition
├── frontend/
│   ├── src/
│   │   ├── routes/             # TanStack Router pages (search, workflow, review, library, paper detail)
│   │   └── components/         # React UI & real-time streaming AgentChat components
│   └── Dockerfile              # Production multi-stage frontend container
├── infra/
│   ├── docker-compose.yml      # Multi-container orchestration
│   └── k8s/                    # Kubernetes production manifests (Deployments, Services, Ingress)
└── docker-compose.yml          # Root Docker Compose file
```

---

## API Reference

| Tag | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **health** | `GET` | `/healthz` | Liveness verification (`{"status": "ok"}`) |
| **auth** | `POST` | `/auth/register` | Create a new user account |
| **auth** | `POST` | `/auth/login` | Obtain JWT access token |
| **search** | `POST` | `/search` | Redis-cached & rate-limited arXiv + Semantic Scholar search |
| **workspaces** | `GET` | `/workspaces` | List current user's workspaces |
| **workspaces** | `POST` | `/workspaces` | Create a new workspace |
| **workspaces** | `GET` | `/workspaces/{id}` | Retrieve a single workspace owned by user |
| **workspaces** | `PUT` | `/workspaces/{id}` | Rename a workspace |
| **workspaces** | `DELETE` | `/workspaces/{id}` | Delete a workspace |
| **workspaces** | `POST` | `/workspaces/{id}/papers` | Save papers to workspace & persist to DB |
| **workspaces** | `DELETE` | `/workspaces/{id}/papers/{paper_id}` | Remove paper from workspace |
| **workspaces** | `GET` | `/workspaces/{id}/documents` | List generated documents in workspace |
| **documents** | `POST` | `/documents` | Enqueue background document generation job (Report/Literature review/Summary/Outline/Brief) |
| **documents** | `GET` | `/documents/{id}` | Poll document generation status and content |
| **documents** | `DELETE` | `/documents/{id}` | Delete a generated document |
| **agent** | `POST` | `/agent/run` | Real-time dual-pipeline (fast + deep) streaming agent execution (SSE) |
| **discover** | `POST` | `/discover/chat` | Discover-page chat for intent-based filtering, ranking, and corpus scoping |
| **papers** | `GET` | `/papers/{id}` | Fetch a saved durable paper by ID |
| **papers** | `GET` | `/papers/{id}/similar` | Find semantically similar papers using `pgvector` |

---

## Development Roadmap

- [x] **Sprint 0: Skeleton Setup** — FastAPI app, logging, settings, DB session, Vite proxy
- [x] **Sprint 1: Auth** — JWT register/login, bcrypt password hashing, protected routes
- [x] **Sprint 2: Workspaces** — PostgreSQL-backed workspace CRUD, paper linking, TanStack Query integration
- [x] **Sprint 3: Real Paper Search** — Live arXiv & Semantic Scholar search, normalization, deduplication, relevance ranking, open-access `pdf_url`
- [x] **Sprint 4: Redis Caching & Search Optimizations** — Redis search caching, durable `Paper` table & upsert
- [x] **Sprint 5: AI Paper Analysis Schema** — Database columns and models for structured AI analysis
- [x] **Sprint 6: pgvector Integration & Semantic Search** — Voyage AI embeddings (512-dim), `pgvector` HNSW indexing, and cosine similarity endpoint
- [x] **Sprint 7: LangGraph Research Agent** — Multi-node research agent graph with fast/deep dual-pipeline orchestration, intent routing, and real-time SSE streaming
- [x] **Sprint 8: Automated Document Generation** — PostgreSQL-persisted document generation, Celery background worker, durable polling, and workspace document review / export UI
- [x] **Sprint 9: Auth Hardening & Ownership** — Strict resource-level authorization checks across all workspace and document APIs, and sliding-window rate limiting on `/search` and `/agent/run`
- [x] **Sprint 10: Testing, Observability & Deployment** — End-to-end integration test suite, GitHub Actions CI workflow, full-stack Docker Compose orchestration, and Kubernetes production manifests

All 10 planned sprints are complete.

---

## License

MIT License.
