import type { Metadata } from "next"
import { TriangleAlert } from "lucide-react"

import { DrilldownTable } from "@/components/situation-analysis/drilldown-table"
import { PrAgingChart } from "@/components/situation-analysis/pr-aging-chart"
import { RootCauseCards } from "@/components/situation-analysis/root-cause-cards"
import { RootCauseChart } from "@/components/situation-analysis/root-cause-chart"
import { RootCauseTrendChart } from "@/components/situation-analysis/root-cause-trend-chart"
import { SummaryKpis } from "@/components/situation-analysis/summary-kpis"
import { formatCount } from "@/lib/utils"
import {
  getAgingBuckets,
  getDrillDownItems,
  getRootCauses,
  getRootCauseTrend,
  getSituationKpiSummary,
} from "@/lib/api/situation-analysis"

export const metadata: Metadata = {
  title: "Situation analysis — Spares AI",
}

export default async function SituationAnalysisPage() {
  const [summary, rootCauses, trend, agingBuckets, drillDownItems] = await Promise.all([
    getSituationKpiSummary(),
    getRootCauses(),
    getRootCauseTrend(),
    getAgingBuckets(),
    getDrillDownItems(),
  ])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Situation Analysis — Root-Cause &amp; Fishbone Drill-Down
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the VZI open PR/PO backlog is stuck, why, and who owns it.
          </p>
        </div>

        <SummaryKpis summary={summary} />

        {/* Section B — hero view */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                Why it&apos;s stuck — root-cause attribution
              </h2>
              <p className="text-xs text-muted-foreground">
                Total days lost per Fishbone category
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
              <TriangleAlert className="size-3.5" />
              Top 3 True Root Cause Cluster
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Total days lost by category
              </h3>
              <RootCauseChart data={rootCauses} />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Monthly trend
              </h3>
              <RootCauseTrendChart trend={trend} rootCauses={rootCauses} />
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <RootCauseCards causes={rootCauses} />
          </div>
        </div>

        {/* Section C */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">
            PR aging distribution
          </h2>
          <p className="text-xs text-muted-foreground">
            Open PRs by age bucket · total {formatCount(summary.totalOpenPrs)}
          </p>
          <div className="mt-2">
            <PrAgingChart buckets={agingBuckets} over30Pct={summary.prOver30Pct} />
          </div>
        </div>

        {/* Section D */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Open PR/PO drill-down — where &amp; who it&apos;s stuck with
          </h2>
          <DrilldownTable
            items={drillDownItems}
            rootCauseCategories={rootCauses.map((c) => c.category)}
          />
        </div>
      </div>
    </div>
  )
}
