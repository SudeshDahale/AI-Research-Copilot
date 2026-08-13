# Arclight

![Arclight Banner](assets/cover.png)

An AI-powered research copilot for discovering, curating, and analyzing scientific papers.

---

## Overview

**Arclight** is a full-stack research assistant that lets you search millions of scientific papers from arXiv and Semantic Scholar, organize them into workspaces, and run a scoped research agent across your curated collections.

---

## Current Features

### Paper Discovery
- Full-text search powered by live calls to **arXiv** and **Semantic Scholar** APIs.
- Results are **normalized**, **deduplicated** (by DOI, arXiv ID, or fuzzy title match), and **ranked** by lexical similarity to the query.
- Filter results by year range, minimum citation count, venue, and topic tags.
- Papers with open-access PDFs expose a direct `pdf_url`; the paper detail page renders a working **Open PDF** button that opens the source PDF in a new tab.

### Authentication
- JWT-based register and login backed by PostgreSQL.
- Passwords hashed with bcrypt; tokens expire after 24 hours.

### Workspaces
- Create named workspaces and link any discovered papers to them.
- Add or remove individual papers; rename or delete workspaces.
- Workspace membership is persisted in PostgreSQL — data survives page refreshes.
- Per-workspace scoped agent chat for focused analysis (literature review, gap finding, methodology comparison).

### Research Agent Chat
- Conversational agent available on the Discover page (general scope) and within each Workspace (paper-scoped).
- Generates structured responses: literature reviews, research gaps, methodology comparisons, summaries.
- Agent can create a workspace from the current search results on request.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19 · TypeScript 5.8 · Vite 8 · TanStack Router · TanStack Query |
| **Backend** | FastAPI · SQLAlchemy 2.0 (Async) · Pydantic Settings · Alembic |
| **Database** | PostgreSQL 15+ |
| **Cache / Broker** | Redis |
| **External APIs** | arXiv Atom Feed · Semantic Scholar Graph API |

---

## How to Run Locally

### Prerequisites
- **Python 3.11 or 3.12**
- **Node.js 18+** and npm
- **PostgreSQL** running locally with a database named `arclight`
- **Redis** (e.g. running via WSL: `sudo service redis-server start`)

---

### 1. Clone the Repository
```bash
git clone https://github.com/SudeshDahale/AI-Research-Copilot.git
cd AI-Research-Copilot
```

---

### 2. Configure the Backend Environment
Create `backend/.env` by copying the example and filling in your values:

```env
# --- App ---
APP_NAME=Arclight
ENVIRONMENT=development
DEBUG=true

# --- Database ---
# Replace <user> and <password> with your local PostgreSQL credentials
DATABASE_URL=postgresql+asyncpg://<user>:<password>@localhost:5432/arclight

# --- Redis ---
REDIS_URL=redis://localhost:6379/0

# --- Auth ---
JWT_SECRET=change-me-to-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# --- LLM (not yet wired up) ---
LLM_API_KEY=
```

> **Never commit real passwords or secrets to version control.**

---

### 3. Set Up the Backend
```bash
cd backend

# Create and activate the virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

# Install dependencies
pip install -e .

# Run database migrations
alembic upgrade head
```

---

### 4. Start the Backend
```bash
# From the backend/ directory with the virtual environment active
python -m uvicorn app.main:app --port 8001 --reload
```

- **API base**: `http://localhost:8001/api/v1`
- **Interactive docs**: `http://localhost:8001/docs`
- **Health check**: `http://localhost:8001/api/v1/healthz`

---

### 5. Set Up and Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

- **App**: `http://localhost:8080` (Vite will pick the next available port if 8080 is busy)

---

## Project Structure

```
AI-Research-Copilot/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py             # JWT register & login
│   │   │   ├── search.py           # Multi-source paper search endpoint
│   │   │   ├── workspaces.py       # Workspaces CRUD
│   │   │   └── router.py           # Main API router & healthcheck
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic-settings configuration
│   │   │   ├── logging.py          # Structured logging
│   │   │   └── security.py         # Password hashing & JWT
│   │   ├── db/
│   │   │   └── session.py          # Async SQLAlchemy engine & get_db
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   └── workspace.py
│   │   ├── schemas/
│   │   │   ├── search.py           # PaperSchema (includes pdf_url)
│   │   │   └── workspace.py
│   │   ├── services/
│   │   │   ├── paper_service.py    # arXiv & Semantic Scholar fetch, merge, dedup
│   │   │   ├── ranking_service.py  # Lexical relevance scoring
│   │   │   └── workspace_service.py
│   │   ├── migrations/             # Alembic migration scripts
│   │   └── main.py
│   ├── alembic.ini
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/             # Shared UI components
│   │   ├── routes/
│   │   │   ├── index.tsx           # Login / register
│   │   │   ├── _app.tsx            # App shell & navigation
│   │   │   ├── _app.search.tsx     # Discover — live paper search
│   │   │   ├── _app.workflow.index.tsx  # Workspaces list
│   │   │   ├── _app.workflow.$id.tsx    # Workspace detail & agent chat
│   │   │   ├── _app.papers.$id.tsx      # Paper detail with Open PDF
│   │   │   ├── _app.library.tsx    # Saved library
│   │   │   └── _app.review.tsx     # Literature review editor
│   │   └── lib/
│   │       ├── workspaces.ts       # TanStack Query workspace hooks
│   │       ├── paper-cache.ts      # Session paper cache (localStorage)
│   │       ├── agent.ts
│   │       └── mock-data.ts        # Paper type definitions & seed data
│   ├── vite.config.ts              # Dev proxy: /api → localhost:8001
│   └── package.json
├── Arclight-Implementation-Plan.md
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Tag | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **health** | `GET` | `/healthz` | Liveness check — returns `{"status": "ok"}` |
| **auth** | `POST` | `/auth/register` | Create a new account |
| **auth** | `POST` | `/auth/login` | Obtain a JWT access token |
| **search** | `POST` | `/search` | Search arXiv + Semantic Scholar; returns ranked papers with `pdf_url` |
| **workspaces** | `GET` | `/workspaces` | List all workspaces for the current user |
| **workspaces** | `POST` | `/workspaces` | Create a workspace |
| **workspaces** | `PUT` | `/workspaces/{id}` | Rename a workspace |
| **workspaces** | `DELETE` | `/workspaces/{id}` | Delete a workspace |
| **workspaces** | `POST` | `/workspaces/{id}/papers` | Add papers to a workspace |
| **workspaces** | `DELETE` | `/workspaces/{id}/papers/{paper_id}` | Remove a paper from a workspace |

---

## Development Roadmap

- [x] **Sprint 0: Skeleton Setup** — FastAPI app, logging, settings, DB session, Vite proxy
- [x] **Sprint 1: Auth** — JWT register/login, bcrypt password hashing, protected routes
- [x] **Sprint 2: Workspaces** — PostgreSQL-backed workspace CRUD, paper linking, TanStack Query integration
- [x] **Sprint 3: Real Paper Search** — Live arXiv & Semantic Scholar search, normalization, deduplication, relevance ranking, open-access `pdf_url`
- [ ] **Sprint 4: Redis Caching & Search Optimizations** (Planned)
- [ ] **Sprint 5: LLM Paper Analysis** (Planned)
- [ ] **Sprint 6: pgvector Integration & Semantic Search** (Planned)
- [ ] **Sprint 7: LangGraph Research Agent** (Planned)
- [ ] **Sprint 8: Automated Document Generation** (Planned)

---

## License

MIT License
