# Spares AI — Initiative 9 (PR-to-PO Cycle Time) + Initiative 8 (Refurbishable Spares)

Vedanta's procurement platform for measuring — and starting to automate — the mining
spares procurement lifecycle: **RR → DOA → MRP → PR → RFQ → Ariba → Auction → NFA → PO**.

> **Every number in this repository is synthetic.** All data is generated locally by
> `backend/scripts/generate_synthetic_data.py` and does **not** represent live SAP ECC,
> Ariba, or SharePoint data. That includes the VZI dashboard (`/dashboard`) and the
> Situation Analysis page — both are computed live from the generated dataset by
> `backend/app/services/dashboard_service.py`. Re-running the generator with a different
> seed changes every figure on every page.

## 1. Project purpose

**Initiative 9** instruments the procurement lifecycle so bottlenecks can be measured: PR/PO
process visibility, cycle-time analytics, open PR/PO monitoring, bottleneck identification,
AI-guided RR creation, PR line-item/service-code quality checks, an approval workflow,
audit, notifications, and dashboards.

**Initiative 8** adds refurbishable-spares tracking on top: it stops VZI paying twice for
one requirement by buying a new unit while the same part is already out for repair. See
[§14](#14-initiative-8--refurbishable-spares-tracking).

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

## 3. One data lane: everything is computed from the generated dataset

Earlier builds served the VZI dashboard and Situation Analysis page from fixed,
hand-transcribed reference numbers. **That is no longer the case** — nothing on any page is
hardcoded. `backend/app/services/dashboard_service.py` computes both views live from the
same rr/pr/po/materials/users CSVs that power `/api/analytics/*`, so a different
`SYNTHETIC_DATA_SEED` changes them exactly as it changes everything else.

**Two document types share the pr/po tables.** Initiative 8 introduced `doc_type` on `pr`
and `po`, distinguishing `NEW_BUY` from `REPAIR`. This matters when reading the code:

| Lane | Documents | Served by |
|---|---|---|
| New procurement (Initiative 9) | `doc_type = NEW_BUY` | `analytics_service`, `dashboard_service` — both filter repairs out |
| Refurbishment (Initiative 8) | `doc_type = REPAIR` | `repair_register_service` |

Repair documents are deliberately excluded from every Initiative 9 analytic. Letting a
refurbishment into the RR→PO cycle-time or the open-PR position would silently change what
those numbers mean.

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
    app/                    routes: /materials /audit /dashboard /approvals /notifications
                            /repair-register /declarations /chat/... /login
    components/             UI components
    lib/
      api/                  frontend API client (one file per backend domain)
      mock-data.ts          LEGACY -- still backs the pre-scripted demo chat sessions only
      types.ts              shared frontend types
  backend/
    app/
      api/routes/           one FastAPI router per domain
      schemas/              Pydantic request/response schemas
      services/              business logic (csv_store, approvals, RR creation, analytics, audit,
                             quality rules, dashboards, repair detection/register/attestations)
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

This **overwrites** every generated CSV under `backend/data/`. The generator is
deterministic and produces, by default: 24 users, 220 materials (32 of them repairable),
40 suppliers, 650 RRs, ~1,420 RR line items, ~594 PRs, ~1,280 PR line items, ~507 POs,
~1,100 PO line items, ~3,790 process-stage events, 640 approvals, ~2,960 audit rows,
~1,100 notifications, and 174 attestations.

It is built from **18 named scenarios**, not uniform randomness, so the analytics have real
signal: normal flow, DOA/MRP/RFQ/Ariba/NFA bottlenecks, multi-line PRs, missing service
codes, vague descriptions, long-open PRs, cancellations, rejections, escalations, aged
pending approvals — plus the Initiative 8 set: repair chains in flight, overdue, and
returned, and duplicate requisitions raised both manually and by MRP against a part already
out for repair.

The run ends with a **dataset self-check** (`verify_initiative_8_dataset`). It fails loudly
if the generated data could not actually demonstrate the initiative — no open repair chains,
no seeded duplicates, or no pending declarations — rather than letting you discover an empty
register later.

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
- **Analytics**: `GET /api/analytics/{cycle-time,bottlenecks,open-pr-po,dashboard-summary}`
- **VZI dashboard**: `GET /api/vzi/dashboard`
- **Situation Analysis**: `GET /api/situation-analysis/{aging,root-causes,trend,drilldown,kpi-summary}`
- **Repair (Initiative 8)**: `GET /api/repair/{register,register/plants,chain-check,economics}`,
  `GET /api/repair/attestations{,/pending}`, `POST /api/repair/attestations/{id}/declare`
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
  synthetic; there is no ingestion abstraction/provider layer in this build. Initiative 8's
  real design reads SAP over OData v4; nothing here connects to SAP.
- **Initiative 7 and Initiative 13 are not implemented.** This repo covers Initiatives 9
  and 8.

---

## 14. Initiative 8 — Refurbishable spares tracking

Stops duplicate spend: buying a new unit while the same part is already out for repair.
Implemented as a working mockup on synthetic data — no SAP, no OData, no BAdI.

### 14.1 The four mechanisms

**1 · Identification.** A material is repairable if its code carries the **80-series
convention** (`80-10051`). Nothing is stored — `csv_store.is_repairable_code()` is the single
place that decision is made, exactly as the real solution keys off the SAP material code.
32 of the 220 generated materials are repairable, drawn from the categories genuinely
refurbished rather than replaced (pumps, motors, valves, seals, crusher and milling
components).

**2 · Active chain detection.** A repair chain is active for a (material, plant) pair when
an open, undelivered `REPAIR` requisition or purchase order exists for it. It is derived
live on every lookup rather than cached — the real solution reads EBAN/EKKO/EKPO in real
time, and a materialised copy could drift from the documents it summarises. Plant is part of
the key: a unit under repair for Gamsberg does nothing for a shortage at BMM.

**3 · Condition-to-repair declaration.** The one hard gate in the initiative.

| Path | Where the gate sits | Behaviour |
|---|---|---|
| Manual (`OAR_MANUAL`) | RR creation | The requisition **cannot be created** without the declaration |
| MRP (`MIN_MAX_AUTO`) | DOA approval | The RR saves with a `PENDING` declaration; **approval is blocked** until a planner completes it |
| Chat | RR creation | Same as manual — the assistant must ask, and cannot set the flag itself |

**4 · Two-layer duplicate guard — advisory, never blocking.** A genuine second failure of
the same part is legitimate, so the guard flags and warns but always lets the user proceed.
The goal is not "no duplicates", it is *no duplicate goes unnoticed*.

- **Layer 1 (SAP-native path)** — `POST /api/rr` returns the requisition flagged, with the
  open repair references, vendor and expected return date stored in `duplicate_context`.
- **Layer 2 (conversational path)** — the assistant surfaces the chain plus an economic
  comparison and asks *"Do you still wish to proceed?"* before continuing.

Either way the flag and the declaration travel with the document and appear on the
approver's row, so the approval decision is made with both in view.

### 14.2 Where the enforcement lives

`rr_service.create_rr()` is the **single write path** for requisitions — the REST route and
the AI tool both funnel through it. The declaration gate and the chain check sit inside that
one function, so both layers are enforced by the same code and neither can bypass the other.
`tests/test_repair.py::TestLayer2ConversationalGuard::test_assistant_cannot_create_without_the_user_confirming`
asserts exactly this.

### 14.3 Economic evaluation

Repair-vs-new is **derived, never seeded**. Repair cost comes from the actual open repair
PO's value; new cost and lead time come from the material master; the return date comes from
the repair PO. The material's `repair_cost_factor` is a fallback used only when a chain is
still at requisition stage. An overdue chain never reports as "arrives sooner" — its date has
already passed.

### 14.4 Data model additions

| Table | Change |
|---|---|
| `materials` | `80-` code prefix for repairables; `reorder_point`; `repair_cost_factor` |
| `pr`, `po` | `doc_type` (`NEW_BUY` \| `REPAIR`) |
| `pr`, `rr` | `duplicate_flag`, `duplicate_context` |
| `attestations` *(new)* | The declaration log — the only state the platform owns outright |

`RequestRequisitionOut` now also exposes `trigger_type` and `area`, which were on the row but
undeclared in the schema and therefore invisible to the frontend. The MRP path depends on
`trigger_type`, so this had to be fixed first.

### 14.5 Screens

| Route | Shows |
|---|---|
| `/repair-register` | Every part out for repair, with stock on hand and reorder point beside it. Rows at or below the reorder point while still at the vendor are highlighted — the condition that produces a duplicate order. |
| `/declarations` | The queue of auto-raised requisitions awaiting a planner's declaration, and the full declaration log |
| `/approvals` | Duplicate context and the requisitioner's declaration, inline on the approval |
| `/materials` | A "Repairable" badge on the 80-series population |
| `/chat/assistant` | The Layer 2 conversational guard |

### 14.6 Tests

`backend/tests/test_repair.py` — 31 tests organised around the **six pilot scenarios** in the
Initiative 8 document, so each success criterion there maps onto something executable, plus a
`TestExistingBehaviourPreserved` class guarding the thing most likely to break quietly:
repair documents must stay out of the Initiative 9 analytics lane.

### 14.7 Pending VZI input

Four values are placeholders and are marked as such in the code:

1. **Which categories are genuinely refurbished** — currently pumps, motors, valves, seals,
   crusher and milling components (`REPAIRABLE_GROUPS`)
2. **Repair turnaround** — currently 21–60 days (`REPAIR_TURNAROUND_DAYS`)
3. **Repair cost as a share of new** — currently 28–45% (`REPAIR_COST_FACTOR_RANGE`)
4. **The exact declaration wording** — currently "I confirm the existing item has been
   assessed and cannot be repaired." (`ATTESTATION_STATEMENT`)

### 14.8 Out of scope

Gate pass administration, closure and lifecycle automation, vendor follow-up, and end-to-end
repair tracking — all excluded by the Initiative 8 brief itself. MRP behaviour is simulated,
not real: auto-triggered requisitions are generated, and the gate is demonstrated on them.
