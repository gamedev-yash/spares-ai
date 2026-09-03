import { CircleDot } from "lucide-react"

import type { InitiativeHealth } from "@/lib/domain/contracts"
import { cn } from "@/lib/utils"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { deriveOverallHealth } from "@/features/initiative-7/utils/inventory-calc"
import type { RiskLevel } from "@/components/shared/risk-badge"

const HEALTH_LABEL: Record<InitiativeHealth, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
}

const HEALTH_CLASS: Record<InitiativeHealth, string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
}

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"]

const RISK_BAR_CLASS: Record<RiskLevel, string> = {
  critical: "bg-destructive",
  high: "bg-[color-mix(in_oklch,var(--warning)_40%,var(--destructive)_60%)]",
  medium: "bg-warning",
  low: "bg-success",
}

/** Health rollup + a risk-level breakdown bar for the Overview page. */
export function InventoryHealthCard() {
  const health = deriveOverallHealth(RECOMMENDATIONS)
  const total = RECOMMENDATIONS.length
  const counts = RISK_ORDER.map((level) => ({
    level,
    count: RECOMMENDATIONS.filter((r) => r.risk === level).length,
  }))

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex items-center gap-1.5 text-sm font-medium", HEALTH_CLASS[health])}>
        <CircleDot className="size-3.5" />
        {HEALTH_LABEL[health]}
      </div>
      <div className="flex flex-col gap-2">
        {counts.map(({ level, count }) => (
          <div key={level} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground capitalize">{level}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", RISK_BAR_CLASS[level])}
                style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-[11px] font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stockout-risk distribution across all {total} tracked recommendations.
      </p>
    </div>
  )
}
