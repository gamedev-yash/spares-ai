# Spares AI

**One product, one Git repository, two independently deployable applications.**

Spares AI covers three business initiatives — they are modules of a single product,
not separate applications:

| Module | Scope |
| --- | --- |
| **Initiative 07** | Predictive Inventory & Safety Stock Optimization |
| **Initiative 08** | Refurbishable Spares Tracking |
| **Initiative 13** | OAR Utilisation Tracking |

## Architecture

```
                    Git repository (one .git/)
                              │
              ┌───────────────┴───────────────┐
              │                               │
          frontend/                        backend/
      Next.js + React + TS               FastAPI + Python
              │                               │
      Frontend hosting                 Azure App Service
              │                               │
              └────────── HTTPS API ──────────┘
```

The two applications share a repository and nothing else: separate dependency
manifests, separate processes, separate ports, separate deployments. They are never
packaged into one process.

## Repository layout

```
spares-ai/
├── frontend/          Next.js application (UI, mock data, dashboards)
├── backend/           FastAPI application (API foundation)
├── docs/              Architecture notes, product spec, mockup reference
├── .gitignore         Single ignore file for the whole repo
└── README.md
```

## Running locally

Two processes, two terminals.

### Frontend — http://localhost:3000

```bash
cd frontend
npm install
npm run dev
```

### Backend — http://localhost:8000

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

| What | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend (service index) | http://localhost:8000/ |
| Swagger UI | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/health |

## Frontend ↔ backend

```
Frontend  ->  NEXT_PUBLIC_API_BASE_URL  ->  FastAPI
```

Set in `frontend/.env.local` (copy `frontend/.env.example`):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

All backend calls go through `frontend/src/lib/api/client.ts` so the base URL is never
hardcoded in components.

## Status

The backend is a **foundation only**. The frontend is unchanged and still runs entirely
on its own mock data — nothing has been migrated to the backend.

Intentionally not implemented yet: I07/I08/I13 business logic, SAP OData, Azure SQL,
Entra ID authentication, RBAC, workflows, notifications, LLM orchestration, and the
deployment pipeline.

See [docs/](docs/) for details, and each application's README:
[frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md).
