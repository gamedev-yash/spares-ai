"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TooltipContentProps } from "recharts"

import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import { getCycleTime, getDashboardSummary, type CycleTime, type DashboardSummary } from "@/lib/api/analytics"
import { formatCount, formatZARMillions } from "@/lib/utils"

function StageChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">
        Avg duration: <span className="font-medium text-foreground">{payload[0].value} days</span>
      </div>
    </div>
  )
}

export function LiveCycleTimeTab() {
  const [cycleTime, setCycleTime] = useState<CycleTime | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCycleTime(), getDashboardSummary()])
      .then(([ct, s]) => {
        setCycleTime(ct)
        setSummary(s)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load analytics."))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!cycleTime || !summary) {
    return (
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Skeleton className="h-32 lg:col-span-12" />
        <Skeleton className="h-80 lg:col-span-12" />
      </div>
    )
  }

  const stageData = Object.entries(cycleTime.stage_wise_avg_days)
    .map(([stage, days]) => ({ stage, days }))
    .sort((a, b) => b.days - a.days)

  const kpiCards = [
    {
      label: "Open PRs (synthetic)",
      figure: formatCount(summary.open_pr_count),
      sub: `${formatZARMillions(summary.open_pr_value / 1_000_000)} value`,
    },
    {
      label: "Open POs (synthetic)",
      figure: formatCount(summary.open_po_count),
      sub: `${formatZARMillions(summary.open_po_value / 1_000_000)} value`,
    },
    {
      label: "Avg cycle time (RR -> PO)",
      figure: cycleTime.average_days != null ? `${cycleTime.average_days}d` : "-",
      sub: `median ${cycleTime.median_days}d · P90 ${cycleTime.p90_days}d`,
    },
    {
      label: "Bottleneck stage",
      figure: cycleTime.bottleneck_stage ?? "-",
      sub: `${summary.prs_over_30_days} PRs open > 30 days`,
      danger: true,
    },
  ]

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
        Synthetic demo data — computed live from the generated Initiative-9 RR→PO dataset
        (backend/scripts/generate_synthetic_data.py), not the VZI reference slides above.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">{card.label}</div>
            <div
              className={
                "mt-1.5 text-2xl font-semibold " + (card.danger ? "text-destructive" : "text-foreground")
              }
            >
              {card.figure}
            </div>
            <div className="mt-1 text-xs leading-snug text-muted-foreground">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <DashboardCard
          title="Average duration per pipeline stage"
          subtitle="RR_CREATED -> DOA -> MRP -> PR_CREATED -> RFQ -> ARIBA -> AUCTION -> NFA -> PO_CREATED"
          span={12}
        >
          <div style={{ height: 320 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid horizontal vertical={false} stroke="var(--border)" />
                <XAxis dataKey="stage" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={40} />
                <Tooltip content={StageChartTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar dataKey="days" name="Avg duration (days)" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}
