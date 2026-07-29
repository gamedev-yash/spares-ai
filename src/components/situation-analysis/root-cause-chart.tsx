"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts"

import type { RootCauseDelayPoint } from "@/lib/types"

function RootCauseTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as RootCauseDelayPoint | undefined
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {point.totalDaysLost} days lost
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {point.category} · {point.itemCount} item{point.itemCount === 1 ? "" : "s"}
      </div>
    </div>
  )
}

export function RootCauseChart({ data }: { data: RootCauseDelayPoint[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 28, left: 0, bottom: 4 }}
          barCategoryGap="28%"
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="category"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={168}
          />
          <Tooltip
            content={RootCauseTooltip}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          />
          <Bar
            dataKey="totalDaysLost"
            fill="var(--chart-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="totalDaysLost"
              position="right"
              formatter={(value) => `${value}d`}
              fontSize={11}
              fill="var(--muted-foreground)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
