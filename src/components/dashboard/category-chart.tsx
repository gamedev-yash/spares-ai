"use client"

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts"

import { CATEGORY_COLORS } from "@/lib/constants"
import type { CategoryBreakdownPoint } from "@/lib/types"

function CategoryTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as CategoryBreakdownPoint | undefined
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{point.category}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">
        {point.value} alternates found
      </div>
    </div>
  )
}

export function CategoryChart({ data }: { data: CategoryBreakdownPoint[] }) {
  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="category"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((point) => (
                <Cell key={point.category} fill={CATEGORY_COLORS[point.category]} />
              ))}
            </Pie>
            <Tooltip content={CategoryTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((point) => (
          <li
            key={point.category}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[point.category] }}
            />
            {point.category}
          </li>
        ))}
      </ul>
    </div>
  )
}
