"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts"

import type { FishboneRootCause } from "@/lib/types"

const TOP_DRIVER_COUNT = 3

function RootCauseTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as FishboneRootCause | undefined
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {point.daysLost} days lost
      </div>
      <div className="mt-0.5 text-muted-foreground">{point.category}</div>
    </div>
  )
}

export function RootCauseChart({ data }: { data: FishboneRootCause[] }) {
  return (
    <div className="h-[320px] w-full">
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
            unit="d"
          />
          <YAxis
            type="category"
            dataKey="category"
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={210}
          />
          <Tooltip
            content={RootCauseTooltip}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          />
          <Bar dataKey="daysLost" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            {data.map((point, i) => (
              <Cell
                key={point.category}
                fill={i < TOP_DRIVER_COUNT ? "var(--chart-1)" : "var(--muted-foreground)"}
                fillOpacity={i < TOP_DRIVER_COUNT ? 1 : 0.45}
              />
            ))}
            <LabelList
              dataKey="daysLost"
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
