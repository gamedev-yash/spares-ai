"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts"

import type { VziTotals } from "@/lib/types"
import { formatZARMillions } from "@/lib/utils"

const COLORS = ["var(--chart-1)", "var(--chart-2)"]

function DonutTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">
        {formatZARMillions(point.value)}
      </div>
      <div className="mt-0.5 text-muted-foreground">{point.name}</div>
    </div>
  )
}

export function PoValueDonut({ value }: { value: VziTotals }) {
  const data = [
    { name: "Material", value: value.material },
    { name: "Service", value: value.service },
  ]
  const servicePct = ((value.service / value.total) * 100).toFixed(1)

  return (
    <div className="w-full">
      <div className="relative h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((point, i) => (
                <Cell key={point.name} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={DonutTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-semibold text-foreground">{servicePct}%</div>
          <div className="text-[10px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Service
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        {data.map((point, i) => (
          <div key={point.name} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i] }}
            />
            {point.name}
          </div>
        ))}
      </div>
    </div>
  )
}
