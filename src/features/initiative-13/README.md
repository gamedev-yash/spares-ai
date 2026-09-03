# Initiative 13 — OAR Utilization Tracking

End-to-end tracking of Order-As-Required (OAR) spares demand, from the
original request through Reservation → PR → PO → Goods Receipt → Goods Issue
→ Utilization Confirmation. A high-fidelity UI mockup with deterministic mock
data — no real backend/SAP calls anywhere in this module.

## Ownership

Everything under `src/features/initiative-13/**` and the thin route wrappers
under `src/app/oar-utilization/**` belongs to Initiative 13. No other
initiative may import from this folder except through the two contracts
listed under "Integration points" below. This module never imports from
`@/features/initiative-7/**` or `@/features/initiative-8/**`, and never edits
any Initiative 9 file.

**Files other initiatives must not modify:** the entire `src/features/initiative-13/**`
tree, including `manifest.ts`, every file under `selectors/`, `components/`,
`pages/`, `data/`, `types/`, `hooks/` and `utils/`, and this README — this
also covers `selectors/oar-lookup.ts` and `components/oar-consumption-plan-extension.tsx`,
the two files the shared `RRExtensionSlot` (owned by the global shell) calls
into.

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/oar-utilization` | `pages/overview-page.tsx` | KPIs + charts: unutilized value/qty, plan compliance, aging, redeployment/purchase-avoidance |
| `/oar-utilization/ledger` | `pages/ledger-page.tsx` | Central screen — every reservation line with its full document chain, expandable rows |
| `/oar-utilization/aging-exceptions` | `pages/aging-exceptions-page.tsx` | Overdue consumption lines — Confirm Consumed / Re-plan / No Longer Required, plus escalation timeline |
| `/oar-utilization/redeployment` | `pages/redeployment-page.tsx` | Cross-plant unused-stock matches for a requested material, advisory only |
| `/oar-utilization/reclassification` | `pages/reclassification-page.tsx` | Frequent-use OAR materials flagged for stocked-material review, links out to Initiative 7 |

## Business entities / types (`types/oar.ts`)

- `UtilizationLedgerLine` — one reservation-anchored ledger row (tracking ID,
  document chain, requester, plant, department, quantities at each stage,
  aging, exception type). `stage: LedgerStage`.
- `DocumentChainStep` — one hop in the RR → Reservation → PR → PO → GR → GI →
  Confirmation chain, rendered via the shared `Timeline` component.
- `EscalationTimelineEvent` — one step in the Requester → HOD → Inventory
  Control escalation chain.
- `RedeploymentCandidate` / `RedeploymentMatch` — a requested material at one
  plant matched against unused stock at the other plants.
- `ReclassificationCandidate` — consumption-frequency stats + recommendation
  for a stocked-material review.

These are Initiative 13's own types, intentionally richer than the shared
`@/lib/domain/contracts` shapes — no initiative-specific fields were added to
that shared file.

## Mock datasets (`data/`)

- `materials.ts` — `materialRef()`/`unitPriceFor()` resolve real Initiative 9
  catalog materials by id, falling back to a small synthetic OAR-only
  material (`OAR-77002`) not present in the shared catalog.
- `ledger.ts` — `LEDGER_LINES`, 11 rows covering seed scenarios E (happy
  path, `OAR-LDG-0001`), F (confirmation overdue, `OAR-LDG-0002`), G (no
  longer required → redeployment pool, `OAR-LDG-0003`), H (three
  reservations consolidated into one PR/PO, `OAR-LDG-0004..0006`,
  `allocationMethod: "Shared / FIFO Mock Allocation"`), I (frequent-use
  reclassification candidate `500-31005`, `OAR-LDG-0007`), plus four filler
  lines (one previously re-planned, one early-stage) spanning all three
  plants and six departments.
- `escalations.ts` — `ESCALATION_TIMELINES`, keyed by ledger line id, named
  people sourced from `@/lib/shared-data/users`.
- `redeployment.ts` — `REDEPLOYMENT_CANDIDATES`, using all three `PLANTS`.
- `reclassification.ts` — `RECLASSIFICATION_CANDIDATES`, includes `500-31005`.
- `overview-metrics.ts` — KPIs computed from `LEDGER_LINES` plus a few
  standalone illustrative chart datasets (aging buckets, plan-vs-actual,
  NM/SM inflow trend).

## Public exports

- `manifest.ts` → `initiative13Manifest` (sidebar nav + suggested questions,
  pre-wired — hrefs unchanged from scaffolding).
- `selectors/summary.ts` → `getInitiative13Summary()` — Spares Control Tower
  overview card + Action Center feed.
- `selectors/material-360-adapter.ts` → `getInitiative13Material360Signal(materialId)`
  — global Material 360 drawer.
- `selectors/global-actions.ts` → `getInitiative13GlobalActions()` — global
  Action Center, derived from ledger exception lines + reclassification data.
- `selectors/audit-events.ts` → `getInitiative13AuditEvents()` — global Audit
  Trail, derived from the ledger's document chain, escalation timelines and
  reclassification flags (seeded/static — UI actions on the Aging
  Exceptions/Redeployment pages simulate a write via toast + local component
  state, matching how Initiative 9's own Approvals table works, and do not
  mutate this feed).
- `selectors/oar-lookup.ts` → `isOARMaterial(materialId)` — gates the RR
  extension slot in Initiative 9's chat.
- `components/oar-consumption-plan-extension.tsx` → `OARConsumptionPlanExtension`
  — the real consumption-plan capture form rendered inline in chat.

## Shared dependencies used

- Contracts: `@/lib/domain/contracts` (`MaterialReference`, `PlantReference`,
  `SAPDocumentReference`, `GlobalAction`, `AuditEvent`, `InitiativeSummary`,
  `Material360Signal`).
- Master data: `@/lib/shared-data/material-catalog` (`getMaterialById`,
  `REFERENCE_MATERIAL_IDS`), `@/lib/shared-data/plants` (`PLANTS`,
  `getPlantById`), `@/lib/shared-data/users` (`USERS`, `getUserById`).
- UI primitives: `PageHeader`, `KPIStatCard`, `ChartCard`, `FilterBar`,
  `StatusBadge`, `RiskBadge`, `Timeline`, `SAPDocumentChip`,
  `MaterialIdentity`, `AlertBanner`, `EmptyState` — all from
  `@/components/shared/*`. Generic primitives from `@/components/ui/*`
  (`Table*`, `Select*`, `Button`, `Dialog*`, `Input`).
- `useMaterial360` from `@/lib/material-360-context` for Material 360
  click-through.
- Formatting helpers from `@/lib/utils` (`formatZAR`, `formatZARCompact`,
  `formatCount`, `cn`).

## Integration contracts

1. **RR extension slot.** Initiative 9's chat workspace unconditionally
   renders `@/components/shared/rr-extension-slot.tsx` (not owned by this
   module), which calls `isOARMaterial(materialId)` and, if true, renders
   `<OARConsumptionPlanExtension materialId requestType />`. This module only
   ever edits those two files inside its own folder — the render point in
   Initiative 9 is untouched. Material `500-14892` (the material on chat
   session `SPR-2847`, Initiative 9's hero demo session) is included in the
   OAR set, so the extension is visibly demonstrable on an existing session,
   not just on Initiative 13's own scenario data.
2. **Reclassification → Initiative 7.** The "Review in Initiative 7" action
   on the Reclassification page is a plain `<Link href="/inventory-optimization/recommendations?reviewMaterial=<materialId>">`
   — a mock integration event via URL navigation, never an import of an
   Initiative 7 component. `500-31005` is always present in
   `RECLASSIFICATION_CANDIDATES` so this link has a live target.
3. **Zero cross-initiative imports.** This module never imports from
   `@/features/initiative-7/**` or `@/features/initiative-8/**`, and is
   never imported by them.

## Simulated-SAP rule

No action anywhere in this module claims a real SAP write happened.
`SAPDocumentChip` renders mock document references. "Confirm Consumed",
"Re-plan", "No Longer Required", "Recommend Transfer" and the consumption
plan form's submit are all UI-only simulations backed by local component
state and a `sonner` toast.
