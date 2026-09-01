# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build — the only real typecheck/verification gate
npm run start    # serve the production build
npm run lint     # eslint (flat config, next core-web-vitals + typescript)
```

There is no test framework configured and no test files. `npm run build` (tsc via Next + eslint) is the verification step for a change.

Add shadcn primitives with `npx shadcn@latest add <component>` — `components.json` is configured for style `base-nova`, RSC, and `@/` aliases.

## What this is

`spares-ai` is a **fully static, front-end-only mockup** of Vedanta's "Spares AI" procurement platform (alternate part / supplier recommendation for mining operations). There is no backend, no database, no API routes, no auth. Every number, session, and conversation is authored data in `src/lib/`. `PROMPT_SPEC.md` is the original build spec and `MOCKUP_REF.html` the static visual reference — both are historical context, not live artifacts.

Because it's a demo, **fidelity of the authored data matters more than genericity of the code**. Prefer extending the data model in `src/lib/` over introducing abstractions that make the demo data harder to read.

## Architecture

### The chat is the interface

The product concept: procurement doesn't happen on forms, it happens inside a chat session. The AI asks structured questions as *selectable option cards* (not free text), each selection is a logged traceability parameter, and one of those selections *is* the approval trigger. A chat session therefore simultaneously plays three roles: the action, the approval workflow, and the audit record. Keep that invariant when adding features — new interactions belong in the conversation, not in a separate form page.

### Layout composition

`src/app/layout.tsx` mounts `<Sidebar />` permanently and renders the route into a flex column beside it. The **right panel is not part of the root layout** — `ChatWorkspace` renders it, so only chat routes have three columns; dashboard/materials/approvals/audit are two-column scroll views (`min-h-0 flex-1 overflow-y-auto p-6`). The whole app is a fixed-viewport, non-scrolling body; every scroll region is explicit.

### Chat playback model (`src/components/chat/chat-workspace.tsx`)

Sessions in `mock-data.ts` are complete authored scripts, but the UI reveals them progressively:

- `computeVisibleMessages` walks the script and **stops at the first unanswered option group**. Answering it reveals the next turn, and synthesizes a "you selected X" user bubble in between.
- An `OptionGroupData` with `locked: true` is history — it was already answered when the session was authored, is seeded as resolved on mount, and never blocks the cascade. Unlocked groups are live and clickable.
- `advanceWorkflow()` is the single shared side effect of "the user completed a step": it moves the stepper's active step to done, bumps `trace.selectionsDone`, and flips pending emails to sent. It fires from a group with `advancesWorkflow: true` and from the `proceed` action.
- All of this is `useState` inside `ChatWorkspace`, keyed by `session.id` — **nothing persists**. Navigating away and back resets the session to its authored state. That is intentional for a demo; don't add persistence without being asked.

### Data layer

- **`src/lib/mock-data.ts`** (~2400 lines) is the single source of truth for suppliers, materials, alternates, chat sessions, VZI dashboard figures, and the approvals queue. Accessor functions (`getSessionById`, `getActiveSessions`, `getMaterialById`, `createDraftSession`, `vzi*`) are the intended entry points.
- **`getAuditLog()` is derived from `CHAT_SESSIONS`**, not authored separately, so `/audit` can never drift from what the conversations actually show. Adding a message to a session automatically adds audit rows.
- **VZI dashboard numbers are transcribed verbatim** from the Vedanta Zinc International review slides (ported from an internal Dash app). The comments say it explicitly: do not re-derive, "correct", or recompute them — including the data-quality flags in `VZI_FLAGS`. Derived helpers only restate them.
- **`src/lib/situation-analysis-data.ts` is server-only.** It `fs.readFileSync`s `src/lib/data/vzi_situation_analysis.csv` at module load and parses it with `src/lib/csv.ts`. Import it only from Server Components and pass results down as props — importing it from a `"use client"` file breaks the build.
- Dates and times in mock data are **pre-formatted strings** (`"14 Mar 2026"`, `"10:23 AM"`), not `Date`s. Live timestamps generated at interaction time go through `formatTime12h`.

### Server/client boundary and the icon registry

Pages are Server Components that read mock data and pass it to `"use client"` leaf components (~29 of them). Because data crosses that boundary, **data objects reference icons by string key, never by component**: `IconKey` in `types.ts`, resolved through the `ICONS` record in `constants.ts`. Adding an icon means adding it to both the union and the record.

### Styling and tokens

- Tailwind v4, configured entirely in `src/app/globals.css` (`@theme inline` + CSS variables) — there is no `tailwind.config`.
- Semantic tokens beyond stock shadcn: `--success`, `--warning`, and `--chart-1..5`, each defined for light and `.dark`. Use these, plus the `StatusBadge` / `PriceDisplay` / `CategoryTag` wrappers in `components/shared/`, rather than raw color classes — that's what keeps dark mode correct.
- Chart colors come from `constants.ts`: `CATEGORY_COLORS` is fixed per plant area (assigned by entity, so filtering can't repaint the survivors) and `VZI_AGING_COLORS` is a good→critical ramp built with `color-mix` over the status tokens.
- Dark mode is `next-themes` with the `class` strategy, defaulting to system.

### UI primitives

`src/components/ui/` is shadcn's **`base-nova` style, built on `@base-ui/react` — not Radix**. Import paths (`@base-ui/react/tabs`) and component APIs differ from the Radix-based shadcn most examples assume. Read the existing primitive before extending one.

### Routes

| Route | Notes |
| --- | --- |
| `/` and `/chat` | redirect to `/chat/${DEFAULT_SESSION_ID}` |
| `/chat/[sessionId]` | the hero view; 404s on unknown session |
| `/chat/new/[materialId]` | synthesizes a draft session via `createDraftSession` — this is where a `/materials` row click lands |
| `/dashboard` | VZI open PR & PO position |
| `/dashboard/situation-analysis` | root-cause / fishbone drill-down, CSV-backed |
| `/inventory-optimization` | I07 safety-stock recommendations; data + types colocated in `src/lib/inventory-optimization-data.ts`, not `mock-data.ts` |
| `/materials`, `/approvals`, `/audit` | supporting tables |

Each non-chat route has a sibling `loading.tsx` that mirrors its layout with `Skeleton` blocks; keep those in sync when a page's shape changes. Client components reading `useSearchParams` (e.g. `MaterialsExplorer`) must stay wrapped in `<Suspense>` at the page level.

Note there are two distinct `pr-aging-chart.tsx` files — `components/dashboard/` and `components/situation-analysis/` — with different props and purposes.
