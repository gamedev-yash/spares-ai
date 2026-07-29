import { Clock, FileStack, Flame, TrendingDown } from "lucide-react"

import type { SituationKpiSummary } from "@/lib/types"
import { formatCount, formatZARBillions } from "@/lib/utils"

export function SummaryKpis({ summary }: { summary: SituationKpiSummary }) {
  const [topDriver, secondDriver] = summary.topDrivers

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <FileStack className="size-3.5" />
          Total open PRs
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {formatCount(summary.totalOpenPrs)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {`${summary.prOver30Pct}% / ${formatCount(summary.prOver30)} PRs > 30 days old`}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <TrendingDown className="size-3.5" />
          Total open PO value
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {formatZARBillions(summary.totalOpenPoValueZar)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          across {formatCount(summary.totalOpenPos)} POs
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Clock className="size-3.5" />
          Service PO concentration
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {formatZARBillions(summary.servicePoValueZar)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {summary.servicePct}% of total open value
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Flame className="size-3.5" />
          Top delay drivers
        </div>
        <div className="mt-2 text-2xl font-semibold text-destructive">
          {topDriver.daysLost}d
        </div>
        <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {topDriver.category} &amp; {secondDriver.category} ({secondDriver.daysLost}d)
        </div>
      </div>
    </div>
  )
}
