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

import type { SavingsTrendPoint } from "@/lib/types"
import { formatZAR, formatZARCompact } from "@/lib/utils"

function SavingsTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  if (typeof value !== "number") return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{label} 2026</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">
        {formatZAR(value)}
      </div>
    </div>
  )
}

export function SavingsChart({ data }: { data: SavingsTrendPoint[] }) {
  return (
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
            width={48}
            tickFormatter={(value: number) => formatZARCompact(value)}
          />
          <Tooltip content={SavingsTooltip} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--primary)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
