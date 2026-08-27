import Link from "next/link"
import type { Metadata } from "next"

import { AgingStrip } from "@/components/dashboard/aging-strip"
import { KpiRow } from "@/components/dashboard/kpi-row"
import { PrPoTabs } from "@/components/dashboard/pr-po-tabs"
import { StatusBadge } from "@/components/shared/status-badge"
import { getUtilizationDashboard } from "@/lib/api/utilization"
import { getVziDashboard } from "@/lib/api/vzi"
import { formatZAR } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Open PR & PO position — Spares AI",
}

export default async function DashboardPage() {
  const [dashboard, utilization] = await Promise.all([getVziDashboard(), getUtilizationDashboard()])
  const summary = dashboard.kpiSummary

  const utilizationKpis = [
    { label: "Unutilized OAR value", figure: formatZAR(utilization.unutilizedPosition.kpis.unutilizedOarValue) },
    { label: "Overdue consumption", figure: formatZAR(utilization.unutilizedPosition.kpis.overdueValue), danger: true },
    { label: "Released stock", figure: formatZAR(utilization.unutilizedPosition.kpis.releasedForRedeployment) },
    { label: "Purchase avoidance", figure: formatZAR(utilization.redeployment.kpis.purchaseAvoidanceValue), success: true },
  ]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Vedanta Zinc International · Procurement Review
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              Open PR &amp; PO position
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Gamsberg &amp; Black Mountain Mining (BMM) — counts and value of
              open purchase requisitions and orders.
            </p>
          </div>
          <StatusBadge tone="default" className="shrink-0">
            Computed from generated data
          </StatusBadge>
        </div>

        <KpiRow summary={summary} />

        <Link
          href="/utilization/analytics"
          className="grid grid-cols-2 gap-3 rounded-xl border border-dashed border-border p-3 transition-colors hover:border-primary/40 sm:grid-cols-4"
        >
          {utilizationKpis.map((card) => (
            <div key={card.label}>
              <div className="text-xs font-medium text-muted-foreground">{card.label} (Initiative 13)</div>
              <div className={`mt-1 text-lg font-semibold ${card.danger ? "text-destructive" : card.success ? "text-success" : "text-foreground"}`}>
                {card.figure}
              </div>
            </div>
          ))}
        </Link>

        <AgingStrip buckets={dashboard.aging} over30={summary.prOver30} />
        <PrPoTabs dashboard={dashboard} />

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Source: the synthetic Initiative-9 dataset (backend/data/*.csv), computed live —
          re-running the generator with a different seed changes these numbers. Values in
          ZAR Mn.
        </p>
      </div>
    </div>
  )
}
