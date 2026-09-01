import type { Metadata } from "next"

import { InventoryKpiRow } from "@/components/inventory-optimization/inventory-kpi-row"
import { InventoryWorkspace } from "@/components/inventory-optimization/inventory-workspace"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  CHANGE_PROPOSAL_BATCHES,
  INVENTORY_KPI,
  PARAMETER_RECOMMENDATIONS,
  SNAPSHOT_DATE,
  isStockOutRisk,
} from "@/lib/inventory-optimization-data"

export const metadata: Metadata = {
  title: "Predictive Inventory — Spares AI",
}

export default function InventoryOptimizationPage() {
  const sampleStockOutRisk =
    PARAMETER_RECOMMENDATIONS.filter(isStockOutRisk).length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Vedanta Zinc International · Predictive Inventory
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              Predictive inventory &amp; safety stock optimization
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              The ML layer over the Initiative 11 rule-based SAP planning
              baseline. It reads consumption history and lead-time actuals and
              recommends revised reorder point, safety stock and max stock per
              material — the planner decides.
            </p>
          </div>
          <StatusBadge tone="default" className="shrink-0">
            Mock data — planner-approved workflow
          </StatusBadge>
        </div>

        <InventoryKpiRow
          summary={INVENTORY_KPI}
          sampleSize={PARAMETER_RECOMMENDATIONS.length}
          sampleStockOutRisk={sampleStockOutRisk}
        />

        <InventoryWorkspace
          recommendations={PARAMETER_RECOMMENDATIONS}
          batches={CHANGE_PROPOSAL_BATCHES}
        />

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Snapshot as at {SNAPSHOT_DATE}. Mock dataset — consumption history and
          lead-time actuals stand in for the SAP MM/IM extract. Z-segment
          materials (erratic demand and insurance spares) are excluded from
          automatic proposals and routed to engineering review. Values in ZAR.
        </p>
      </div>
    </div>
  )
}
