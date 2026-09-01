# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The repo root is `spares-ai/` (one level below the `Vedanta/` workspace folder). All commands
below assume you are in `spares-ai/` unless stated otherwise.

See `README.md` for full documentation (setup, env vars, data model, API surface, known
limitations). This file only covers what a coding agent needs that isn't obvious from a
quick skim of the code. `PROMPT_SPEC.md` and `MOCKUP_REF.html` are the *original* mockup
brief — historical, superseded by the current build; don't treat them as current spec.

## This is not the Next.js you know

Per `AGENTS.md`: Next.js 16.2.11 has breaking changes vs. training data — APIs, conventions,
and file structure may differ. Read the relevant guide in `node_modules/next/dist/docs/`
(it ships `01-app/`, `02-pages/`, `03-architecture/`) before writing Next.js code, and heed
deprecation notices. Concrete example already in the tree: middleware is `src/proxy.ts`
exporting `proxy()`, not `middleware.ts`/`middleware()`.

## Commands

```bash
# Backend (from backend/)
./.venv/Scripts/activate                    # Windows venv
uvicorn app.main:app --reload --port 8000   # dev server, http://localhost:8000/docs for Swagger

./.venv/Scripts/python.exe -m pytest                              # full suite
./.venv/Scripts/python.exe -m pytest -q --tb=short                # quiet
./.venv/Scripts/python.exe -m pytest tests/test_rr.py             # one file
./.venv/Scripts/python.exe -m pytest tests/test_rr.py::test_name  # one test

python scripts/generate_synthetic_data.py                     # regenerate backend/data/*.csv (seed 12345)
python scripts/generate_synthetic_data.py --seed 777          # different deterministic dataset
python scripts/generate_synthetic_data.py --only-initiative-7 # just the inventory tables +
                                                              # materials.csv's I7 columns,
                                                              # reusing procurement data on disk

# Frontend (from repo root)
npm run dev      # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit  # no frontend test runner is wired up — this is the fastest sanity check
```

Backend and frontend must both be running for the *backend-backed* pages (`/login`, `/materials`,
`/dashboard`, `/approvals`, `/audit`, `/notifications`, `/chat/assistant`). `/inventory/*` is the
exception — it runs with the frontend alone (see below). Frontend needs `NEXT_PUBLIC_API_BASE_URL`
(`.env`, from `.env.example`) pointing at the backend.

## Architecture — two independent halves

This repo hosts **two initiatives that share a Next.js shell and a seed dataset but nothing else**.
Confusing them is the single easiest way to break something here.

### Initiative 9 — procurement lifecycle (backend-backed)

```
Next.js ──HTTP/REST──▶ FastAPI ──reads/writes──▶ CSV files (backend/data/*.csv)
```

Routes: `/materials` `/dashboard` `/dashboard/situation-analysis` `/approvals` `/audit`
`/notifications` `/chat/...` `/login`.

No database, no ORM, no auth enforcement, no Docker — this is a demo/dev build.
`backend/app/services/csv_store.py` is the entire persistence layer: loads every CSV into
memory at startup; every `insert`/`update` mutates memory and immediately rewrites the whole
file under a lock. Not safe for concurrent writes — fine at this scale, not a pattern to
extend into anything production-shaped. Chat session/message state is the one exception:
purely in-memory (`ChatStore`), lost on backend restart.

**Nothing on any page is hardcoded reference data anymore.** Earlier builds served the VZI
dashboard and Situation Analysis from hand-transcribed slide-deck constants
(`services/vzi_reference_data.py`, `data/situation_analysis.csv`) — **both were deleted**.
`services/dashboard_service.py` now computes both views live from the same synthetic
rr/pr/po/process_stage_events data that powers `/api/analytics/*`, returning the same dict
shapes so `api/routes/vzi.py` and `api/routes/situation_analysis.py` needed no changes beyond
their data source. A different `--seed` therefore changes the dashboard numbers too. If you
find older docs or comments describing a "real reference lane vs. synthetic lane" split
(README §3 still does), they are out of date.

### Initiative 7 — predictive inventory (client-side only)

Routes: `/inventory` `/inventory/approvals` `/inventory/pipeline` `/inventory/recommendations`
`/inventory/exceptions` `/inventory/policies` `/inventory/reports`.

```
Browser ──fetch()──▶ /public/data/*.csv ──papaparse──▶ RecommendationEngine (all in-browser)
```

**It never calls the FastAPI backend.** It is a stakeholder mockup: every number is computed
in the browser from static CSVs. Deliberate — don't "fix" it by wiring it to the API.

- `src/lib/inventory/data/csv.ts` — `fetch` + papaparse with a per-path promise cache; all
  numeric/boolean coercion is explicit in each loader's `mapRow`, never implicit.
- `src/lib/inventory/context.tsx` — `InventoryProvider`, mounted only by
  `src/app/inventory/layout.tsx` so it doesn't run on other routes. Builds one
  `RecommendationEngine` per data load so every screen reads identical numbers.
- `src/lib/inventory/calc/` — the engine: `classification` (history gate + ADI/CV²
  Syntetos-Boylan), `forecast` (statistical / SBA), `leadTime`, `serviceLevel`, `oar`
  (cold-start via nearest-neighbor similarity), `risk`, `recommendation` (orchestrates, emits
  a structured `TraceStep[]` that the "Technical details" drawer renders as formula/inputs/
  result columns), `config` (all tunable constants).
- Approval state (`src/lib/inventory/approvals.ts` + context) is **session-only React state**:
  a four-stage `APPROVAL_CHAIN`, no persistence, no backend write-back, resets on refresh.
  Unrelated to Initiative 9's `/approvals` page and `approvals.csv`.
- `/inventory/*` has its own visual layer: `src/app/inventory/theme.css` (`--i7-*` variables,
  loaded globally because the sidebar uses them) and `src/components/inventory/ui/primitives.tsx`
  — inline-styled, ported 1:1 from the approved mockup, intentionally *not* the shadcn
  components in `src/components/ui/`. Match the local idiom when editing here.

Two constraints the code enforces and its comments call out explicitly — preserve both:

- `ILLUSTRATIVE_Z_FACTORS` in `calc/config.ts` stands in for service-level policy that has
  not been signed off (`criticality_policy.csv` ships with `status="PENDING_SIGNOFF"` and
  blank targets). Never present these as approved policy in the UI; always label them
  "illustrative, pending sign-off".
- "Now" comes from `deriveReferenceNow()`/`deriveMonthWindow()` in `calc/months.ts` — derived
  from the last month in `consumption_history.csv`, not the browser clock — so the demo still
  reads correctly long after the seed data was generated. Don't substitute `new Date()`.

### The `public/data` mirror — easy to miss

`public/data/*.csv` are **byte-identical manual copies** of the subset of `backend/data/*.csv`
that Initiative 7 reads (materials, suppliers, po, po_line_items, equipment, consumption_history,
goods_receipt, current_inventory, criticality_policy, maintenance_orders, equipment_utilization,
users). Both directories are committed. Nothing automates the copy — there is no npm script, and
the generator only writes `backend/data/`. **After running the generator, copy the changed files
to `public/data/` or the two halves of the app will silently disagree.**

## Repository layout

```
src/                        Next.js App Router
  app/                      routes (see the two initiative sections above)
  proxy.ts                  cookie-presence redirect (Next 16 name for middleware); UX only
  lib/api/                  Initiative-9 frontend API client, one file per backend domain,
                            all through apiFetch() in client.ts (base URL, bearer token,
                            error normalization) — components never call fetch directly
  lib/inventory/            Initiative-7 client-side data + calc engine + UI helpers
  lib/mock-data.ts          LEGACY — only backs the pre-scripted /chat/[sessionId] demo
backend/
  app/api/routes/           one FastAPI router per domain
  app/schemas/              Pydantic request/response schemas
  app/services/             csv_store, approvals, RR creation, analytics, dashboard, audit,
                            quality rules
  app/ai/                   LLM provider abstraction, tool registry, chat orchestrator
  data/                     CSV files — source of truth, committed
  scripts/                  synthetic data generator + material/supplier catalog
  tests/                    pytest; each test gets a fresh empty tmp_path CSV dir via the
                            `store`/`client` fixtures in conftest.py — never backend/data/
```

## AI architecture (`backend/app/ai/`)

`provider_base.py` defines the `LLMProvider` interface; `demo_provider.py` is deterministic and
needs no API key (default, `AI_MODE=demo`); `anthropic_provider.py`/`openai_provider.py` run real
tool-calling loops; `factory.py` raises rather than silently falling back to demo if provider mode
is requested without a key. `tools.py` is the *only* way the assistant touches data — every tool
handler goes through the normal backend services/CSV store; the LLM never touches a file directly.
`orchestrator.py` wires `POST /api/chat`: demo mode is fully rule-based routing (no LLM call),
provider mode hands routing to the model's tool-calling loop. `pr_quality.py` /
`services/quality_validation.py` are deterministic rules for PR line-item quality — an optional
LLM only narrates the rule output, never decides what counts as an issue. Switching to a real
model is env-var only: `AI_MODE=provider`, `AI_PROVIDER=anthropic|openai`, matching API key.

## Auth and errors

**Auth: none, by design for this phase.** `POST /api/auth/login` returns the user's bare id as a
"token" if `employee_code` exists and is active in `users.csv`; the password is accepted but never
checked. No route enforces RBAC or 401s except unknown/inactive login. A bearer token, when
present, only attributes audit/notification rows. Don't "fix" this — see README §9. Note that
`src/proxy.ts`'s comment claiming "every API route validates the JWT independently" is wrong, as
is `src/lib/api/client.ts`'s reference to Docker Compose networking — there is no JWT and no Docker.

**Errors**: every API error uses one envelope, `{"error": {"code", "message", "details"}}`;
stack traces are logged, never sent to the client.
