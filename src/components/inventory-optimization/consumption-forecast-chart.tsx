"use client"

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import type {
  ConsumptionPoint,
  ParameterSet,
} from "@/lib/inventory-optimization-data"
import { formatCount } from "@/lib/utils"

const ACTUAL_COLOR = "var(--chart-1)"
const FORECAST_COLOR = "var(--chart-2)"
const CURRENT_ROP_COLOR = "var(--muted-foreground)"
const RECOMMENDED_ROP_COLOR = "var(--primary)"

function ForecastTooltip({
  active,
  payload,
  unitOfMeasure,
}: TooltipContentProps & { unitOfMeasure: string }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as ConsumptionPoint | undefined
  if (!point) return null

  const isForecast = point.actual === null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{point.monthLong}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="inline-block h-0.5 w-3 shrink-0"
          style={{ backgroundColor: isForecast ? FORECAST_COLOR : ACTUAL_COLOR }}
        />
        <span className="text-muted-foreground">
          {isForecast ? "Forecast" : "Actual"}:
        </span>
        <span className="font-medium text-foreground">
          {formatCount(isForecast ? (point.forecast ?? 0) : (point.actual ?? 0))}{" "}
          {unitOfMeasure}
        </span>
      </div>
      {isForecast && point.band && (
        <div className="mt-0.5 text-muted-foreground">
          Band {formatCount(point.band[0])}–{formatCount(point.band[1])}{" "}
          {unitOfMeasure}
        </div>
      )}
    </div>
  )
}

function LegendKey({
  color,
  dashed,
  swatch,
  children,
}: {
  color: string
  dashed?: boolean
  swatch?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch ? (
        <span
          className="h-2.5 w-3 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color, opacity: 0.25 }}
        />
      ) : (
        <span
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={
            dashed
              ? {
                  backgroundImage: `repeating-linear-gradient(to right, ${color} 0 3px, transparent 3px 6px)`,
                }
              : { backgroundColor: color }
          }
        />
      )}
      {children}
    </div>
  )
}

export function ConsumptionForecastChart({
  series,
  current,
  recommended,
  unitOfMeasure,
}: {
  series: ConsumptionPoint[]
  current: ParameterSet
  recommended: ParameterSet | null
  unitOfMeasure: string
}) {
  return (
    <div className="w-full">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              interval={2}
              minTickGap={12}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
            />
            <Tooltip
              content={(props: TooltipContentProps) => (
                <ForecastTooltip {...props} unitOfMeasure={unitOfMeasure} />
              )}
              cursor={{ stroke: "var(--border)" }}
            />

            <Area
              dataKey="band"
              stroke="none"
              fill={FORECAST_COLOR}
              fillOpacity={0.18}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke={FORECAST_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              connectNulls={false}
              isAnimationActive={false}
            />

            <ReferenceLine
              y={current.rop}
              stroke={CURRENT_ROP_COLOR}
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            {recommended && (
              <ReferenceLine
                y={recommended.rop}
                stroke={RECOMMENDED_ROP_COLOR}
                strokeWidth={1.5}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendKey color={ACTUAL_COLOR}>Actual consumption</LegendKey>
        <LegendKey color={FORECAST_COLOR} dashed>
          Forecast
        </LegendKey>
        <LegendKey color={FORECAST_COLOR} swatch>
          Forecast band
        </LegendKey>
        <LegendKey color={CURRENT_ROP_COLOR} dashed>
          Current ROP {formatCount(current.rop)}
        </LegendKey>
        {recommended && (
          <LegendKey color={RECOMMENDED_ROP_COLOR}>
            Recommended ROP {formatCount(recommended.rop)}
          </LegendKey>
        )}
      </div>
    </div>
  )
}
