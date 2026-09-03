"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { circuitExposure } from "@/features/initiative-7/utils/inventory-calc"

const AT_RISK_COLOR = "var(--destructive)"
const HEALTHY_COLOR = "var(--chart-1)"

function ExposureTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Recommendations per circuit, split by stockout-risk exposure (high/critical vs. low/medium). */
export function CircuitExposureChart() {
  const data = circuitExposure()

  return (
    <div className="w-full">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            barCategoryGap="28%"
          >
            <CartesianGrid horizontal={false} vertical stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="circuit"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={80}
            />
            <Tooltip content={ExposureTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar
              dataKey="atRisk"
              name="At risk (high/critical)"
              stackId="stack"
              fill={AT_RISK_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Bar
              dataKey="healthy"
              name="Low/medium risk"
              stackId="stack"
              fill={HEALTHY_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: AT_RISK_COLOR }} />
          At risk (high/critical)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: HEALTHY_COLOR }} />
          Low/medium risk
        </div>
      </div>
    </div>
  )
}
