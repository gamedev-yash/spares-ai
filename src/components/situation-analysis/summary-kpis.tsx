import { ClipboardList, Clock, Flame, Signpost } from "lucide-react"

import type { SituationAnalysisSummary } from "@/lib/types"
import { formatZAR } from "@/lib/utils"

export function SummaryKpis({
  summary,
}: {
  summary: SituationAnalysisSummary
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <ClipboardList className="size-3.5" />
          Total open PRs &amp; POs
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {summary.totalCount}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatZAR(summary.totalValueZar)} total value
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Clock className="size-3.5" />
          Avg days stuck
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {summary.avgDaysStuck.toFixed(1)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          days per open item, on average
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Signpost className="size-3.5" />
          Top bottleneck stage
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          Stage {summary.topBottleneckStage.no}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {summary.topBottleneckStage.name}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          <Flame className="size-3.5" />
          High risk / overdue
        </div>
        <div className="mt-2 text-2xl font-semibold text-destructive">
          {summary.highRiskCount}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          of {summary.totalCount} stuck &gt; 10 days
        </div>
      </div>
    </div>
  )
}
