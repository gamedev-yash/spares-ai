"use client"

import type { StagePipelinePoint } from "@/lib/types"
import { cn, daysStuckTone, formatZARCompact } from "@/lib/utils"

type Severity = "empty" | "default" | "warning" | "danger"

function severityOf(stage: StagePipelinePoint): Severity {
  if (stage.count === 0) return "empty"
  return daysStuckTone(stage.maxDaysStuck)
}

const SEVERITY_TILE_CLASSES: Record<Severity, string> = {
  empty: "border-dashed border-border bg-muted/20",
  default: "border-border bg-card hover:border-primary/50 hover:bg-accent/60",
  warning: "border-warning/40 bg-warning/10 hover:bg-warning/15",
  danger: "border-destructive/40 bg-destructive/10 hover:bg-destructive/15",
}

const SEVERITY_COUNT_CLASSES: Record<Severity, string> = {
  empty: "bg-muted text-muted-foreground",
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
}

export function StagePipeline({
  stages,
  selectedStage,
  onSelectStage,
}: {
  stages: StagePipelinePoint[]
  selectedStage: number | null
  onSelectStage: (stageNo: number) => void
}) {
  return (
    <div
      role="group"
      aria-label="Process stage pipeline — click a stage to filter the table below"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      {stages.map((stage) => {
        const severity = severityOf(stage)
        const isSelected = stage.stageNo === selectedStage
        return (
          <button
            key={stage.stageNo}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectStage(stage.stageNo)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
              "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              SEVERITY_TILE_CLASSES[severity],
              isSelected && "border-primary ring-2 ring-primary/30"
            )}
          >
            <div className="flex w-full items-center justify-between gap-1">
              <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Stage {stage.stageNo}
              </span>
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  SEVERITY_COUNT_CLASSES[severity]
                )}
              >
                {stage.count}
              </span>
            </div>
            <div className="line-clamp-2 min-h-8 text-[12.5px] leading-tight font-medium text-foreground">
              {stage.stageName}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {stage.count === 0
                ? "No items"
                : `${formatZARCompact(stage.valueZar)} · ${stage.maxDaysStuck}d max`}
            </div>
          </button>
        )
      })}
    </div>
  )
}
