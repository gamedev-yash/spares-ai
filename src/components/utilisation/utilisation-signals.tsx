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

import { StatusBadge } from "@/components/shared/status-badge"
import {
  NM_SM_INFLOW_TREND,
  RECLASSIFICATION_CANDIDATES,
} from "@/lib/utilisation-data"
import { formatCount, formatZARMillions } from "@/lib/utils"

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-muted-foreground">
        {typeof value === "number" ? formatZARMillions(value) : value} crossing an
        aging threshold
      </div>
    </div>
  )
}

export function UtilisationSignals() {
  const first = NM_SM_INFLOW_TREND[0]?.valueZarMn ?? 0
  const last = NM_SM_INFLOW_TREND[NM_SM_INFLOW_TREND.length - 1]?.valueZarMn ?? 0
  const declinedPct = first > 0 ? Math.round(((first - last) / first) * 100) : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium text-foreground">NM/SM inflow trend</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Value of OAR stock newly crossing an aging threshold each month — the
            initiative&apos;s primary trend, expected to decline
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-success">
              -{declinedPct}%
            </span>
            <span className="text-xs text-muted-foreground">
              {formatZARMillions(first)} → {formatZARMillions(last)} since{" "}
              {NM_SM_INFLOW_TREND[0]?.month}
            </span>
          </div>
          <div className="mt-2 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={NM_SM_INFLOW_TREND}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
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
                  width={32}
                />
                <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--border)" }} />
                <Line
                  type="monotone"
                  dataKey="valueZarMn"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-2)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-foreground">
            Reclassification candidates
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            OAR materials consumed more than 4 times in 12 months — advisory
            signal for Order-to-Stock review under Initiatives 11 &amp; 7
          </div>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {RECLASSIFICATION_CANDIDATES.map((c) => (
              <div
                key={c.materialCode}
                className="rounded-lg border border-border bg-muted/30 p-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[13px] font-medium text-foreground">
                    {c.materialCode} · {c.description}
                  </div>
                  <StatusBadge tone="warning">
                    {formatCount(c.consumptionsLast12Mo)}/yr · {c.plant}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {c.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
