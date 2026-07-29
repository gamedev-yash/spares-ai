import type { Metadata } from "next"

import { RootCauseChart } from "@/components/situation-analysis/root-cause-chart"
import { SituationBoard } from "@/components/situation-analysis/situation-board"
import { SummaryKpis } from "@/components/situation-analysis/summary-kpis"
import {
  PR_PO_SITUATIONS,
  getRootCauseBreakdown,
  getSituationAnalysisSummary,
  getStagePipeline,
} from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Situation analysis — Spares AI",
}

export default function SituationAnalysisPage() {
  const summary = getSituationAnalysisSummary()
  const stagePipeline = getStagePipeline()
  const rootCause = getRootCauseBreakdown()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Situation Analysis — Open PR &amp; Open PO Monitor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time bottleneck identification, cycle time drill-down, and
            root-cause delay attribution.
          </p>
        </div>

        <SummaryKpis summary={summary} />

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">
            Why it&apos;s stuck — total days lost by root cause
          </h2>
          <p className="text-xs text-muted-foreground">
            Across all {summary.totalCount} open PRs/POs
          </p>
          <div className="mt-2">
            <RootCauseChart data={rootCause} />
          </div>
        </div>

        <SituationBoard items={PR_PO_SITUATIONS} stagePipeline={stagePipeline} />
      </div>
    </div>
  )
}
