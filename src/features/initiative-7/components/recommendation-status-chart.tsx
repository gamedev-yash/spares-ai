"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts"

import { statusDistribution } from "@/features/initiative-7/utils/inventory-calc"
import type { RecommendationStatus } from "@/features/initiative-7/types/inventory"

const STATUS_COLOR: Record<RecommendationStatus, string> = {
  "Pending Review": "var(--chart-4)",
  "In Approval": "var(--chart-1)",
  Approved: "var(--chart-3)",
  Implemented: "var(--chart-5)",
  Returned: "var(--warning)",
  Rejected: "var(--destructive)",
}

function StatusTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  if (!point || typeof point.value !== "number") return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-sm font-semibold text-foreground">{point.value}</div>
      <div className="mt-0.5 text-muted-foreground">{point.name}</div>
    </div>
  )
}

export function RecommendationStatusChart() {
  const data = statusDistribution()
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="w-full">
      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
              ))}
            </Pie>
            <Tooltip content={StatusTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-semibold text-foreground">{total}</div>
          <div className="text-[10px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Total</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
            {d.status} ({d.count})
          </div>
        ))}
      </div>
    </div>
  )
}
