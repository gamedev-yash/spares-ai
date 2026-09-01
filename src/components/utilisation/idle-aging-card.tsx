"use client"

import { TwoSeriesBarChart } from "@/components/dashboard/two-series-bar-chart"
import {
  IDLE_AGING_BUCKETS,
  idleAgingByPlantZarMn,
  idleAgingTotalZarMn,
} from "@/lib/utilisation-data"
import { formatZARMillions } from "@/lib/utils"

const GAMSBERG = { key: "Gamsberg", name: "Gamsberg", color: "var(--chart-1)" }
const BMM = { key: "BMM", name: "BMM", color: "var(--chart-2)" }

export function IdleAgingCard() {
  const byPlant = idleAgingByPlantZarMn()
  const total = idleAgingTotalZarMn()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">
            Idle-stock aging — GR&apos;d, not issued
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Gamsberg {formatZARMillions(byPlant.Gamsberg)} · BMM{" "}
            {formatZARMillions(byPlant.BMM)}
          </div>
        </div>
        <div className="text-xs font-semibold text-destructive">
          {formatZARMillions(total)} idle across both plants
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
    </div>
  )
}
