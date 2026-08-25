import { Check } from "lucide-react"

import type { ComparisonPane } from "@/lib/types"
import { cn, type SeverityTone } from "@/lib/utils"

const VALUE_TONE: Record<"default" | "success" | "danger", string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
}

const BANNER_TONE: Record<SeverityTone, string> = {
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

export function TwoSidedComparison({
  heading,
  left,
  right,
  banner,
}: {
  heading: string
  left: ComparisonPane
  right: ComparisonPane
  banner?: { text: string; tone?: SeverityTone }
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
        <Check className="size-4 text-success" />
        {heading}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ComparisonPaneCard side={left} />
        <ComparisonPaneCard side={right} />
      </div>

      {banner && (
        <div
          className={cn(
            "mt-2.5 rounded-lg px-2.5 py-2 text-[12px]",
            BANNER_TONE[banner.tone ?? "default"]
          )}
        >
          {banner.text}
        </div>
      )}
    </div>
  )
}

function ComparisonPaneCard({ side }: { side: ComparisonPane }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card p-2.5",
        side.highlight ? "border-2 border-primary" : "border border-transparent"
      )}
    >
      <div className="text-[11px] text-muted-foreground">{side.label}</div>
      <div className="my-1 text-[13px] font-medium text-foreground">
        {side.title}
      </div>
      {side.subtitle && (
        <div className="text-xs text-muted-foreground">{side.subtitle}</div>
      )}
      <div
        className={cn(
          "mt-1.5 text-base font-semibold tabular-nums",
          VALUE_TONE[side.primaryTone ?? "default"]
        )}
      >
        {side.primaryValue}
      </div>
      {side.meta && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {side.meta}
        </div>
      )}
    </div>
  )
}
