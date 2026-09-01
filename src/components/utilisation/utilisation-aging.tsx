"use client"

import { TwoSeriesBarChart } from "@/components/dashboard/two-series-bar-chart"
import {
  HISTORICAL_FALLBACK_AGING,
  IDLE_AGING_BUCKETS,
  idleAgingByPlantZarMn,
  idleAgingTotalZarMn,
} from "@/lib/utilisation-data"
import { formatCount, formatZARMillions } from "@/lib/utils"

const GAMSBERG = { key: "Gamsberg", name: "Gamsberg", color: "var(--chart-1)" }
const BMM = { key: "Black Mountain", name: "Black Mountain (BMM)", color: "var(--chart-2)" }

export function UtilisationAging() {
  const byPlant = idleAgingByPlantZarMn()
  const total = idleAgingTotalZarMn()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            Utilisation aging — days past planned consumption date
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Gamsberg {formatZARMillions(byPlant.Gamsberg)} · BMM{" "}
            {formatZARMillions(byPlant["Black Mountain"])}
          </div>
        </div>
        <div className="text-xs font-semibold text-destructive">
          {formatZARMillions(total)} plan-backed
        </div>
      </div>
      <div className="mt-3">
        <TwoSeriesBarChart
          data={IDLE_AGING_BUCKETS}
          categoryKey="bucket"
          seriesA={GAMSBERG}
          seriesB={BMM}
          orientation="horizontal"
          stacked
          height={200}
          categoryWidth={70}
          formatValue={(v) => formatZARMillions(v)}
        />
      </div>
      <div className="mt-3 border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground">
        + {formatZARMillions(HISTORICAL_FALLBACK_AGING.valueZarMn)} across{" "}
        {formatCount(HISTORICAL_FALLBACK_AGING.lineCount)} lines aged via historical
        GR-date fallback — legacy stock that predates consumption-plan capture,
        shown separately rather than mixed into plan-backed aging above.
      </div>
    </div>
  )
}
