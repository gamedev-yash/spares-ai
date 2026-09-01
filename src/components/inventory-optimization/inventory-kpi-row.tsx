import { Banknote, Boxes, Target, TrendingDown, TriangleAlert } from "lucide-react"

import type { InventoryKpiSummary } from "@/lib/inventory-optimization-data"
import { formatCount, formatZARMillions } from "@/lib/utils"

export function InventoryKpiRow({
  summary,
  sampleSize,
  sampleStockOutRisk,
}: {
  summary: InventoryKpiSummary
  /** Rows shown in the workbench below — the KPIs cover the whole scope. */
  sampleSize: number
  sampleStockOutRisk: number
}) {
  // Lower MAPE is better, so an improvement points down.
  const mapeDelta = Math.round((summary.mapePriorPct - summary.mapePct) * 10) / 10
  const improved = mapeDelta > 0

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Boxes className="size-3.5" />
          Materials in review scope
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {formatCount(summary.materialsInScope)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          planned on the I11 baseline · {sampleSize} shown below
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Banknote className="size-3.5" />
          Potential working-capital release
        </div>
        <div className="mt-2 text-2xl font-semibold text-success">
          {formatZARMillions(summary.workingCapitalReleaseMn)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          if every open recommendation is approved
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <TriangleAlert className="size-3.5" />
          Stock-out risk items flagged
        </div>
        <div className="mt-2 text-2xl font-semibold text-warning">
          {formatCount(summary.stockOutRiskItems)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          under-covered on actual lead times · {sampleStockOutRisk} in this sample
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Target className="size-3.5" />
          Forecast accuracy (MAPE)
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-foreground">
            {summary.mapePct}%
          </span>
          {improved && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-success">
              <TrendingDown className="size-3.5" />
              {mapeDelta} pts
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {improved ? "improved from" : "was"} {summary.mapePriorPct}% last quarter
        </div>
      </div>
    </div>
  )
}
