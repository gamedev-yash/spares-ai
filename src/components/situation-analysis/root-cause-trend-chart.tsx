"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import type { FishboneRootCause, RootCauseTrendPoint } from "@/lib/types"

const TOP_DRIVER_COUNT = 3
const TOP_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]
const OTHER_COLOR = "var(--muted-foreground)"
const OTHER_KEY = "Other (4 categories)"
// Fixed calendar order for the X axis — not a data value, just display ordering.
const MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"]

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label} 2026</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3 shrink-0"
            style={{ backgroundColor: String(entry.color) }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}d</span>
        </div>
      ))}
    </div>
  )
}

export function RootCauseTrendChart({
  trend,
  rootCauses,
}: {
  trend: RootCauseTrendPoint[]
  rootCauses: FishboneRootCause[]
}) {
  // 7 categories exceeds the categorical-palette ceiling for a multi-line
  // chart, so the top 3 (already the headline drivers) get their own color
  // and the rest fold into a single de-emphasized "Other" line.
  const topCategories = rootCauses.slice(0, TOP_DRIVER_COUNT).map((c) => c.category)

  const data = MONTHS.map((month) => {
    const point: Record<string, string | number> = { month }
    let other = 0
    for (const entry of trend.filter((t) => t.month === month)) {
      if (topCategories.includes(entry.category)) {
        point[entry.category] = entry.daysLost
      } else {
        other += entry.daysLost
      }
    }
    point[OTHER_KEY] = other
    return point
  })

  return (
    <div className="w-full">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={28}
              unit="d"
            />
            <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--border)" }} />
            {topCategories.map((category, i) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                name={category}
                stroke={TOP_COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: TOP_COLORS[i] }}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey={OTHER_KEY}
              name={OTHER_KEY}
              stroke={OTHER_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: OTHER_COLOR }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {topCategories.map((category, i) => (
          <div key={category} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: TOP_COLORS[i] }}
            />
            {category}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: OTHER_COLOR }}
          />
          {OTHER_KEY}
        </div>
      </div>
    </div>
  )
}
