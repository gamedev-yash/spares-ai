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

export interface BarSeries {
  key: string
  name: string
  color: string
}

/**
 * Reusable two-series bar chart (grouped or stacked, vertical or horizontal) —
 * covers every "material vs service" / "unit vs unit" / "trigger vs trigger"
 * comparison in the VZI dashboard so each one isn't a bespoke chart file.
 */
export function TwoSeriesBarChart({
  data,
  categoryKey,
  seriesA,
  seriesB,
  orientation = "vertical",
  stacked = false,
  height = 300,
  formatValue = (v: number) => String(v),
  categoryWidth,
}: {
  data: object[]
  categoryKey: string
  seriesA: BarSeries
  seriesB: BarSeries
  orientation?: "vertical" | "horizontal"
  stacked?: boolean
  height?: number
  formatValue?: (v: number) => string
  categoryWidth?: number
}) {
  const isHorizontal = orientation === "horizontal"

  function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <div className="font-medium text-foreground">{label}</div>
        {payload.map((entry) => (
          <div key={entry.name} className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3 shrink-0"
              style={{ backgroundColor: String(entry.color) }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === "number" ? formatValue(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const barRadius = stacked
    ? undefined
    : (isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) as [number, number, number, number]

  return (
    <div className="w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isHorizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            barCategoryGap="28%"
            barGap={4}
          >
            <CartesianGrid
              horizontal={!isHorizontal}
              vertical={isHorizontal}
              stroke="var(--border)"
            />
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey={categoryKey}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={categoryWidth ?? 120}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={categoryKey}
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
                  width={40}
                />
              </>
            )}
            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            />
            <Bar
              dataKey={seriesA.key}
              name={seriesA.name}
              fill={seriesA.color}
              stackId={stacked ? "stack" : undefined}
              stroke={stacked ? "var(--card)" : undefined}
              strokeWidth={stacked ? 2 : 0}
              radius={barRadius}
              maxBarSize={isHorizontal ? 22 : 36}
              isAnimationActive={false}
            />
            <Bar
              dataKey={seriesB.key}
              name={seriesB.name}
              fill={seriesB.color}
              stackId={stacked ? "stack" : undefined}
              stroke={stacked ? "var(--card)" : undefined}
              strokeWidth={stacked ? 2 : 0}
              radius={barRadius}
              maxBarSize={isHorizontal ? 22 : 36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        {[seriesA, seriesB].map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  )
}
