import { TriangleAlert } from "lucide-react"

import { REPAIR_STAGES, stageIndex, type RepairStage } from "@/lib/refurbishables-data"
import { cn, type SeverityTone } from "@/lib/utils"

const CURRENT_BAR: Record<SeverityTone, string> = {
  default: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
}

const DONE_BAR: Record<SeverityTone, string> = {
  default: "bg-primary/30",
  warning: "bg-warning/30",
  danger: "bg-destructive/30",
}

const LABEL_CLASS: Record<SeverityTone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
}

/**
 * Compact horizontal step indicator — one bar per lifecycle stage, sized to sit
 * inside a register row. `blocked` marks an un-attested removal: the loop can't
 * advance past step 1 until the condition declaration is complete.
 */
export function StageIndicator({
  stage,
  tone = "default",
  blocked = false,
}: {
  stage: RepairStage
  tone?: SeverityTone
  blocked?: boolean
}) {
  const current = stageIndex(stage)
  const closed = stage === "Back in stock"
  // A blocked removal reads amber, but escalates with its own aging flag.
  const barTone: SeverityTone = blocked && tone !== "danger" ? "warning" : tone
  const label = blocked ? "Awaiting attestation" : stage

  return (
    <div className="flex min-w-[124px] flex-col gap-1.5">
      <div
        className="flex items-center gap-0.5"
        aria-label={`Stage ${current + 1} of ${REPAIR_STAGES.length}: ${label}`}
      >
        {REPAIR_STAGES.map((s, index) => (
          <span
            key={s}
            title={s}
            className={cn(
              "h-1 w-2.5 rounded-full",
              closed && "bg-success/70",
              !closed && index < current && DONE_BAR[barTone],
              !closed && index === current && CURRENT_BAR[barTone],
              !closed && index > current && "bg-muted"
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "flex items-center gap-1 text-[11px] font-medium",
          closed ? "text-success" : LABEL_CLASS[barTone]
        )}
      >
        {blocked && <TriangleAlert className="size-3 shrink-0" />}
        {label}
      </span>
    </div>
  )
}
