"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { FishboneRootCause } from "@/lib/types"
import { cn } from "@/lib/utils"

const TOP_DRIVER_COUNT = 3

export function RootCauseCards({ causes }: { causes: FishboneRootCause[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {causes.map((cause, i) => {
        const isTop3 = i < TOP_DRIVER_COUNT
        const isExpanded = expanded === cause.category
        return (
          <button
            key={cause.category}
            type="button"
            aria-expanded={isExpanded}
            onClick={() =>
              setExpanded((prev) => (prev === cause.category ? null : cause.category))
            }
            className={cn(
              "flex flex-col rounded-xl border p-3.5 text-left transition-colors duration-150",
              "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              isTop3
                ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] leading-snug font-medium text-foreground">
                {cause.category}
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                  isExpanded && "rotate-180"
                )}
              />
            </div>

            <div
              className={cn(
                "mt-1.5 text-xl font-semibold",
                isTop3 ? "text-destructive" : "text-foreground"
              )}
            >
              {cause.daysLost}d
            </div>

            {(isTop3 || cause.badge) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {isTop3 && (
                  <StatusBadge tone="warning">Top 3 True Root Cause Cluster</StatusBadge>
                )}
                {cause.badge && (
                  <StatusBadge
                    tone={cause.badge === "Highest Impact" ? "danger" : "success"}
                  >
                    {cause.badge}
                  </StatusBadge>
                )}
              </div>
            )}

            {isExpanded && (
              <ul className="mt-2.5 list-disc space-y-1 border-t border-dashed border-border pt-2.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                {cause.subCauses.map((sub) => (
                  <li key={sub}>{sub}</li>
                ))}
              </ul>
            )}
          </button>
        )
      })}
    </div>
  )
}
