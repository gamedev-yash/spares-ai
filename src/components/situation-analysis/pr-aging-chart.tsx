"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { VZI_AGING_COLORS } from "@/lib/constants"
import type { VziAgingBucket } from "@/lib/types"
import { formatCount } from "@/lib/utils"

// The first 3 buckets (0-7, 7-15, 15-30 days) are <= 30 days; the boundary
// marker sits at the start of the 4th bucket, where "over 30 days" begins.
const OVER_30_BUCKET = "30-60 days"

function AgingTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as (VziAgingBucket & { pct: string }) | undefined
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatCount(point.count)} PRs
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {point.bucket} · {point.pct}%
      </div>
    </div>
  )
}

export function PrAgingChart({
  buckets,
  over30Pct,
}: {
  buckets: VziAgingBucket[]
  over30Pct: number
}) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const data = buckets.map((b) => ({ ...b, pct: ((b.count / total) * 100).toFixed(1) }))

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={32}
          />
          <Tooltip content={AgingTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <ReferenceLine
            x={OVER_30_BUCKET}
            stroke="var(--foreground)"
            strokeDasharray="4 3"
            label={{
              value: `${over30Pct}% stuck > 30 days`,
              position: "top",
              fill: "var(--foreground)",
              fontSize: 11,
              fontWeight: 500,
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={VZI_AGING_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
