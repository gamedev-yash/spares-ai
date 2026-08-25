# Spares AI — Initiative 9: PR-to-PO Cycle Time Reduction

Vedanta's procurement platform for measuring — and starting to automate — the mining
spares procurement lifecycle: **RR → DOA → MRP → PR → RFQ → Ariba → Auction → NFA → PO**.

> **The procurement data in this repository is synthetic.** It is generated locally by
> `backend/scripts/generate_synthetic_data.py` and does **not** represent live SAP ECC,
> Ariba, or SharePoint data. The VZI dashboard (`/dashboard`) and its slide-deck reference
> constants, and the Situation Analysis root-cause CSV (`backend/data/situation_analysis.csv`),
> are the one exception — those numbers are real, transcribed verbatim from an actual VZI
> review-slides workbook; see [Two data lanes](#3-two-data-lanes-real-reference-vs-synthetic-demo)
> below.

## 1. Project purpose

Initiative 9 instruments the procurement lifecycle so bottlenecks can be measured: PR/PO
process visibility, cycle-time analytics, open PR/PO monitoring, bottleneck identification,
AI-guided RR creation, PR line-item/service-code quality checks, an approval workflow,
audit, notifications, and dashboards.

This is a **demo/dev build, deliberately not production infrastructure**: there is no
database, no authentication, and no Docker. **CSV files under `backend/data/` are the
single source of truth** — a lightweight FastAPI backend reads and writes them directly,
and the existing Next.js frontend is unchanged in look/structure, just wired to call that
backend instead of the mock data it used to ship with.

## 2. Architecture

```
   Next.js  ──────HTTP/REST──────▶  FastAPI  ──────reads/writes──────▶  CSV files
  (frontend)                      (backend)                          backend/data/*.csv
```

No ORM, no SQL, no message queue. `backend/app/services/csv_store.py` is the entire
persistence layer: it loads every CSV into memory once at startup, and every write
(`insert`/`update`) mutates memory and immediately rewrites the file. This is intentionally
simple — fine for the hundreds-to-low-thousands-of-rows scale generated here, but **not**
built for concurrent production writes (no transaction isolation, no WAL).

Chat session/message state is the one thing that is **not** CSV-backed — it lives purely
in memory (`ChatStore` in `csv_store.py`) and does not survive a backend restart. Everything
else (materials, RR/PR/PO, approvals, audit, notifications) does.

## 3. Two data lanes: real reference vs. synthetic demo

The VZI "Open PR & PO Position" dashboard (`/dashboard`) is fed by fixed reference numbers
transcribed from an actual review-slides workbook (`backend/app/services/vzi_reference_data.py`)
and the Situation Analysis root-cause page (`/dashboard/situation-analysis`) is fed by
`backend/data/situation_analysis.csv` (also transcribed, not synthetic) — these are **not**
regenerated or "corrected" by the data generator. The Initiative-9 procurement dataset
(rr/pr/po/approvals/audit/notifications/process_stage_events) is fully **synthetic**,
regenerated fresh whenever you run the seed script, and powers `/api/analytics/*` and the
dashboard's **"Live cycle time"** tab. Never conflate the two.

## 4. Technology stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (`@base-ui/react`), Recharts, lucide-react, sonner |
| Backend | FastAPI, Pydantic v2 / pydantic-settings, plain `csv` module |
| Data | CSV files (`backend/data/*.csv`) — no database |
| Auth | None (see [§9](#9-authentication)) |
| AI | Provider abstraction: demo (deterministic, no key) / Anthropic / OpenAI |
| Testing | pytest (backend) |

## 5. Repository structure

```
spares-ai/
  src/                      Next.js app (App Router)
    app/                    routes: /materials /audit /dashboard /approvals /notifications /chat/... /login
    components/             UI components
    lib/
      api/                  frontend API client (one file per backend domain)
      mock-data.ts          LEGACY -- still backs the pre-scripted demo chat sessions only
      types.ts              shared frontend types
  backend/
    app/
      api/routes/           one FastAPI router per domain
      schemas/              Pydantic request/response schemas
      services/              business logic (csv_store, approvals, RR creation, analytics, audit, quality rules, vzi reference data)
      ai/                     LLM provider abstraction, tool registry, chat orchestrator
      core/                   structured logging, error envelope
    data/                    CSV files -- the source of truth, committed to the repo
    scripts/                 synthetic data generator + material/supplier catalog
    tests/                   pytest suite (runs against a throwaway CSV fixture dir, no DB)
  .env.example, backend/.env.example
```

## 6. Local setup

```bash
# Backend
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows: .venv\Scripts\Activate.ps1 or activate.bat
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal, repo root)
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. There's no real authentication (see
below), so any password works for any employee code that exists in `backend/data/users.csv`.

### Demo accounts

| Employee code | Role |
|---|---|
| DEMO001 | END_USER |
| DEMO002 | ENGINEERING_MANAGER |
| DEMO003 | COMMERCIAL_MANAGER |
| DEMO004 | WAREHOUSE_SUPERVISOR |
| DEMO005 | PROCUREMENT |
| DEMO006 | ADMIN |

(Plus ~18 randomly generated users across the same six roles.)

## 7. Environment variables

| Variable | Purpose |
|---|---|
| `SYNTHETIC_DATA_SEED` | Seed for the generator; same seed = same dataset |
| `DATA_DIR` | Override the CSV directory (defaults to `backend/data`) |
| `AI_MODE` | `demo` (default, no key needed) or `provider` |
| `AI_PROVIDER` | `anthropic` or `openai`, only used when `AI_MODE=provider` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Only required in provider mode for the matching provider |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend → backend base URL |

Never commit a real `.env`. `.gitignore` blocks `.env*` except the `.env.example` files.

## 8. Synthetic data

```bash
cd backend
python scripts/generate_synthetic_data.py            # default seed (12345)
python scripts/generate_synthetic_data.py --seed 777  # a different, still-deterministic dataset
```

This **overwrites** every generated CSV under `backend/data/` (users, materials, suppliers,
rr, rr_line_items, pr, pr_line_items, po, po_line_items, process_stage_events, approvals,
audit_logs, notifications) — `situation_analysis.csv` is untouched (it's real reference
data, not regenerated). The generator is deterministic and produces, by default: 24 users,
220 materials, 40 suppliers, 650 RRs, ~1,500 RR line items, ~550 PRs, ~1,300 PR line items,
~465 POs, ~1,100 PO line items, ~3,850 process-stage events, 646 approvals (mixing PENDING/
APPROVED/REJECTED/ESCALATED), ~2,900 audit rows, and ~1,100 notifications — built from named
scenarios (normal flow, DOA/MRP/RFQ/Ariba/NFA bottlenecks, multi-line PRs, missing service
codes, vague descriptions, long-open PRs, cancellations, rejections, escalations, aged
pending approvals), not uniform randomness, so the analytics have real signal.

Materials and suppliers are curated, category-consistent mining-spares data (bearings,
pumps, valves, motors, conveyor/crusher/milling/flotation components, electrical spares,
instrumentation, mechanical seals) — supplier and manufacturer names are deliberately
fictional, never real company names, since this is fabricated transaction/rating history.

## 9. Authentication

**There is none.** Per the brief for this phase, no JWT, no password hashing, no RBAC
enforcement. `POST /api/auth/login` looks up `employee_code` in `users.csv` and, if it
exists and is active, returns that user's bare id as the "token" — the password field is
accepted but never checked. Every other route works with or without a bearer token: if one
is present and resolves to a real user it's used to attribute audit/notification rows (who
requested this RR, who approved that item); if not, a default demo user is used instead.
Nothing ever 401s except an unknown/inactive `employee_code` at login.

The frontend's `/login` page, `src/proxy.ts` cookie-redirect, and `Authorization: Bearer`
header plumbing are all still there and still work — they're just a UX flow now, not a
security boundary, since there's nothing behind them to secure in this build.

## 10. API documentation

Interactive docs (Swagger UI) at **http://localhost:8000/docs** once the backend is
running. Highlights:

- **Auth**: `POST /api/auth/login`, `GET /api/auth/me`
- **Materials**: `GET /api/materials` (search/filter/paginate), `GET /api/materials/{id}`
- **RR**: `POST /api/rr`, `GET /api/rr`, `GET /api/rr/{id}`, `PATCH /api/rr/{id}`
- **PR**: `GET /api/pr`, `GET /api/pr/{id}`, `GET /api/pr/{id}/quality-check`
- **PO**: `GET /api/po`, `GET /api/po/{id}`
- **Approvals**: `GET /api/approvals`, `POST /api/approvals/{id}/{approve,reject,escalate}`
- **Audit**: `GET /api/audit` (filter by entity type/action/user/date range)
- **Notifications**: `GET /api/notifications`
- **Analytics (synthetic lane)**: `GET /api/analytics/{cycle-time,bottlenecks,open-pr-po,dashboard-summary}`
- **VZI (reference lane)**: `GET /api/vzi/dashboard`
- **Situation Analysis (reference lane)**: `GET /api/situation-analysis/{aging,root-causes,trend,drilldown,kpi-summary}`
- **Chat**: `POST /api/chat`, `GET /api/chat/sessions`, `GET /api/chat/sessions/{id}/messages`
- **Users**: `GET /api/users`, `GET /api/users/{id}`

Every list endpoint is paginated (`page`, `page_size`). Errors share one envelope:
`{"error": {"code", "message", "details"}}`; stack traces are never sent to the client,
only logged.

## 11. AI architecture

`backend/app/ai/`:

- `provider_base.py` — `LLMProvider` interface: `complete()` for simple narrative text,
  `run_tool_loop()` for a full tool-calling conversation.
- `demo_provider.py` — deterministic, no network call, no API key needed. **Default.**
- `anthropic_provider.py` / `openai_provider.py` — real tool-calling loops against each
  provider's native tool-use API.
- `factory.py` — reads `AI_MODE`/`AI_PROVIDER` and returns the right provider; raises
  (never silently falls back to demo) if provider mode is requested without a key.
- `tools.py` — the only way the assistant touches data: `search_materials`, `get_material`,
  `create_rr`, `get_rr`, `get_pr`, `get_po`, `get_open_prs`, `get_open_pos`,
  `get_cycle_time`, `get_bottlenecks`, `get_approval_status`, `get_audit_history`. Every
  handler calls into the CSV store through ordinary backend services — the LLM never touches
  a file directly; in provider mode, the model requests a tool call, the backend executes
  it, and only the JSON result goes back to the model.
- `rr_assistant.py` — deterministic slot-filling for AI-guided RR creation (demo mode):
  extracts quantity/date/material from free text across turns, asks for whatever's missing
  one turn at a time, disambiguates materials via clickable options, confirms before
  creating anything.
- `orchestrator.py` — ties it together for `POST /api/chat`: demo mode uses fully
  rule-based routing (no LLM call at all); provider mode hands routing to the model's own
  tool-calling loop.
- `pr_quality.py` + `services/quality_validation.py` — deterministic PR line-item quality
  rules (missing service code, vague description, duplicate lines); the optional LLM
  explanation only *narrates* the rule output, it never decides what counts as an issue.

### Demo mode vs. real mode

`AI_MODE=demo` (default) is labeled in the UI — the chat header shows a "Demo mode" banner
whenever the backend used deterministic routing. Switching to a real model is just env
vars: `AI_MODE=provider`, `AI_PROVIDER=anthropic` (or `openai`), and the matching API key.

### Chat UI

The prototype's original hand-scripted chat sessions (option cards, comparison cards,
workflow stepper) are **preserved as-is** under `/chat/[sessionId]` — still backed by
`src/lib/mock-data.ts`, still fully interactive, kept as a UI reference; they are not
wired to the backend. The app's default landing page and "New session" both go to
`/chat/assistant`, the real, functional chat, backed by an in-memory session store and the
tool registry above.

## 12. Testing

```bash
cd backend
./.venv/Scripts/python.exe -m pytest              # no database, no external services needed
./.venv/Scripts/python.exe -m pytest -q --tb=short
```

Each test runs against a fresh, empty, throwaway CSV directory (`tmp_path` fixture) — never
against `backend/data/`. Frontend: no test runner is wired up; `npx tsc --noEmit` is the
fastest sanity check after a change.

## 13. Known limitations

- **No authentication** — by design for this phase (see [§9](#9-authentication)); not a bug.
- **Chat history doesn't survive a backend restart** — sessions/messages are in-memory only;
  everything else (RR/PR/PO/approvals/audit/notifications) is CSV-persisted and does.
- **CSV persistence is not safe for concurrent production writes** — fine for a single-user
  local demo; a real deployment would need a real datastore.
- **The legacy scripted chat** (`/chat/[sessionId]`, `/chat/new/[materialId]`) is UI
  reference only — a rich, hand-authored demo with comparison cards and a workflow stepper,
  never wired to the backend, and out of scope for this phase.
- **No email/Teams notification channel** — `notifications.type` is the seam for one, but
  only in-app notifications are implemented.
- **No real SAP/Ariba/SharePoint integration** — the procurement dataset is entirely
  synthetic; there is no ingestion abstraction/provider layer in this build.
- **Initiative 7, Initiative 8, and Initiative 13 are not implemented.** This repo covers
  Initiative 9 only.
