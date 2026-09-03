// Global aggregation of per-initiative summaries/actions/audit events. This
// is the ONLY place that imports every initiative's `selectors/summary.ts`,
// `selectors/global-actions.ts` and `selectors/audit-events.ts` together —
// used by the Spares Control Tower Overview, the Action Center, and the
// Audit Trail. No business logic here, only composition.

import { getInitiative7Summary } from "@/features/initiative-7/selectors/summary"
import { getInitiative7GlobalActions } from "@/features/initiative-7/selectors/global-actions"
import { getInitiative7AuditEvents } from "@/features/initiative-7/selectors/audit-events"
import { getInitiative8Summary } from "@/features/initiative-8/selectors/summary"
import { getInitiative8GlobalActions } from "@/features/initiative-8/selectors/global-actions"
import { getInitiative8AuditEvents } from "@/features/initiative-8/selectors/audit-events"
import { getInitiative13Summary } from "@/features/initiative-13/selectors/summary"
import { getInitiative13GlobalActions } from "@/features/initiative-13/selectors/global-actions"
import { getInitiative13AuditEvents } from "@/features/initiative-13/selectors/audit-events"
import type { AuditEvent, GlobalAction, InitiativeSummary } from "@/lib/domain/contracts"
import { getAuditLog, PENDING_APPROVALS, getVziKpiSummary } from "@/lib/mock-data"
import { formatZARMillions } from "@/lib/utils"

/** Initiative 9 predates the summary/action/audit-event adapter pattern and
 * has no `features/` module of its own — this small inline adapter is the
 * one exception, kept here rather than invented as a fourth "module". */
function getInitiative9Summary(): InitiativeSummary {
  const kpi = getVziKpiSummary()
  const pendingCount = PENDING_APPROVALS.length
  return {
    id: "initiative-9",
    label: "Demand & Procurement",
    href: "/dashboard",
    health: kpi.prOver30Pct > 40 ? "attention" : "healthy",
    metrics: [
      { label: "Open PRs", value: kpi.openPr.total.toLocaleString("en-US") },
      { label: "Open POs", value: kpi.openPo.total.toLocaleString("en-US") },
      { label: "Open PO value", value: formatZARMillions(kpi.openPoValue.total) },
      { label: "PRs > 30 days", value: `${kpi.prOver30Pct.toFixed(0)}%` },
    ],
    actions: PENDING_APPROVALS.slice(0, pendingCount).map((a) => ({
      id: `i9-approval-${a.id}`,
      initiative: "initiative-9",
      title: `Pending approval — ${a.materialDescription}`,
      severity: a.urgency === "Critical" ? "critical" : a.urgency === "High" ? "warning" : "info",
      entityId: a.id,
      materialId: a.materialId,
      href: "/approvals",
      createdAt: a.waitingSince,
    })),
  }
}

export function getAllInitiativeSummaries(): InitiativeSummary[] {
  return [
    getInitiative9Summary(),
    getInitiative7Summary(),
    getInitiative8Summary(),
    getInitiative13Summary(),
  ]
}

export function getAllGlobalActions(): GlobalAction[] {
  return [
    ...getInitiative9Summary().actions,
    ...getInitiative7GlobalActions(),
    ...getInitiative8GlobalActions(),
    ...getInitiative13GlobalActions(),
  ]
}

export function getAllAuditEvents(): AuditEvent[] {
  const initiative9Events: AuditEvent[] = getAuditLog().map((e) => ({
    id: e.id,
    initiative: "initiative-9",
    entityId: e.sessionId,
    eventType: e.action,
    description: e.detail,
    actor: e.actor,
    timestamp: e.timestamp,
  }))
  return [
    ...initiative9Events,
    ...getInitiative7AuditEvents(),
    ...getInitiative8AuditEvents(),
    ...getInitiative13AuditEvents(),
  ]
}
