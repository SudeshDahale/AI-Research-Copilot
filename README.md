# Arclight (Sprint 0 — Skeleton Setup)

![Arclight Banner](assets/cover.png)

FastAPI backend skeleton, database session handler, structured logging, and frontend dev proxy routing.

---

## Overview

This is the repository for **Arclight**, an AI-powered research copilot. 

**Sprint 0** establishes the project's foundation by bootstrapping the FastAPI application, parsing configuration settings, configuring asynchronous SQLAlchemy database sessions, setting up structured logs, and routing API traffic via the frontend's dev server proxy.

---

## Key Features (Sprint 0)

- **FastAPI Core Setup**: A clean backend entry point with CORS enabled for local frontend development.
- **Dynamic Configuration**: Configuration management using Pydantic's `BaseSettings` (`pydantic-settings`) to validate environment variables.
- **Asynchronous SQLAlchemy Session**: Connection pool management utilizing `create_async_engine` and session inject dependency (`get_db`).
- **Structured Stream Logging**: Unified logging output with custom level formatting.
- **Dev Server Proxy Routing**: Seamless Vite dev proxy configuration routing `/api` traffic directly to the backend.

---

## Tech Stack (Sprint 0)

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19 · TypeScript 5.8 · Vite 8 · TanStack Start (Router) |
| **Backend** | FastAPI (Python 3.11+) · SQLAlchemy 2.0 (Async) · Pydantic Settings |
| **Database** | PostgreSQL (supported async connection) |
| **Broker** | Redis (supported connection) |

---

## Getting Started

### Prerequisites
- **Python 3.11** or **3.12**
- **Node.js 18+** and npm or bun
- **PostgreSQL** (running locally or accessible via network)
- **Redis** (running locally or accessible via network)

### 1. Clone the Repository
```bash
git clone https://github.com/SudeshDahale/AI-Research-Copilot.git
cd AI-Research-Copilot
```

### 2. Backend Setup
1. Navigate to the `backend/` directory, set up your virtual environment, and install dependencies:
   ```bash
   cd backend
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # Mac/Linux
   source venv/bin/activate

   pip install -e .
   ```

2. Create a `backend/.env` file from the template:
   ```env
   # --- App ---
   APP_NAME=Arclight
   ENVIRONMENT=development
   DEBUG=true

   # --- Database ---
   DATABASE_URL=postgresql+asyncpg://arclight:arclight@localhost:5432/arclight

   # --- Redis / Celery ---
   REDIS_URL=redis://localhost:6379/0

   # --- Auth (wired up in Sprint 1) ---
   JWT_SECRET=change-me-to-a-random-secret
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_MINUTES=1440

   # --- LLM (wired up in Sprint 5) ---
   LLM_API_KEY=
   ```

### 3. Run the Backend
```bash
# From the backend directory
uvicorn app.main:app --reload --port 8000
```
- **API Endpoint**: `http://localhost:8000`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`
- **Health Check Route**: `http://localhost:8000/api/v1/healthz`

### 4. Frontend Setup
1. Navigate to the `frontend/` directory and install local dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

2. Start the Vite development proxy server:
   ```bash
   npm run dev
   ```
- **Frontend App**: `http://localhost:5173`

---

## Project Structure

```
AI-Research-Copilot/
├── backend/
│   ├── app/
│   │   ├── api/                    # API route handlers
│   │   │   └── v1/
│   │   │       ├── auth.py         # JWT register & login
│   │   │       ├── workspaces.py   # Workspaces CRUD operations
│   │   │       ├── search.py       # Multi-source paper search
│   │   │       ├── agent.py        # LangGraph agent chat interface
│   │   │       ├── documents.py    # Document CRUD & compiles
│   │   │       └── router.py       # Main API router & healthcheck
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic-settings config
│   │   │   ├── logging.py          # Structured stream logs
│   │   │   ├── security.py         # Password hash & token decode
│   │   │   └── cache.py            # Redis client wrapper
│   │   ├── db/
│   │   │   └── session.py          # SQLAlchemy async engine & get_db
│   │   ├── models/                 # SQLAlchemy DB models
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── paper.py
│   │   │   └── document.py
│   │   ├── schemas/                # Pydantic validation schemas
│   │   ├── services/               # Core business services
│   │   │   ├── paper_service.py    # External API parser (arXiv, SS, OpenAlex)
│   │   │   ├── workspace_service.py# Workspaces & papers relationship
│   │   │   ├── ranking_service.py  # Lexical scoring
│   │   │   ├── llm_service.py      # LLM paper prompts & analysis
│   │   │   ├── vector_service.py   # pgvector helper functions
│   │   │   └── document_service.py # Document storage & operations
│   │   ├── workers/                # Celery background tasks
│   │   └── main.py                 # FastAPI application startup entry
│   ├── Dockerfile
│   ├── alembic.ini
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/             # Common UI components
│   │   ├── routes/                 # TanStack Start application routes
│   │   │   ├── index.tsx           # Login / authentication
│   │   │   ├── _app.tsx            # Navigation & application shell layout
│   │   │   ├── _app.search.tsx     # Paper search interface
│   │   │   ├── _app.library.tsx    # Saved workspaces and collections
│   │   │   ├── _app.papers.$id.tsx # Paper analysis page (summary/gaps)
│   │   │   ├── _app.workflow.$id.tsx# Research Agent Chat workflow
│   │   │   └── _app.review.tsx     # Literature review editor/exporter
│   │   ├── lib/                    # Client library files & state managers
│   │   │   ├── agent.ts
│   │   │   ├── agent-plan.ts
│   │   │   ├── workspaces.ts
│   │   │   ├── documents.ts
│   │   │   └── mock-data.ts
│   │   ├── router.tsx
│   │   ├── server.ts
│   │   ├── start.ts
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.ts              # Vite server reverse proxy
│   └── tailwind.config.js
├── Research_Copilot_AI_PRD_TRD.docx# Product Requirement Document
├── Arclight-Implementation-Plan.md # Detail Sprints roadmap
└── README.md                       # Project main README
```


---

## API Documentation

All endpoints are prefixed with `/api/v1`. 

| Tag | Endpoint | Description |
| :--- | :--- | :--- |
| **health** | `GET /healthz` | Verification checks for API liveness and routing. Returns `{"status": "ok"}`. |

---

## Development Roadmap

- [x] **Sprint 0: Skeleton Setup**
  - Setup FastAPI app, structured logging, dynamic settings, database async connections, and the Vite dev proxy.
- [ ] **Sprint 1: Accounts & Real Auth** (Planned)
- [ ] **Sprint 2: Workspaces & Saved Library** (Planned)
- [ ] **Sprint 3: Real Paper Search** (Planned)
- [ ] **Sprint 4: Redis Caching & Search Optimizations** (Planned)
- [ ] **Sprint 5: LLM Paper Analysis** (Planned)
- [ ] **Sprint 6: pgvector Integration & Search** (Planned)
- [ ] **Sprint 7: LangGraph Research Agent** (Planned)
- [ ] **Sprint 8: Automated Doc Gen Workers** (Planned)

---

## License

MIT License
