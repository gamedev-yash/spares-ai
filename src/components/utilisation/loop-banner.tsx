import { ChevronRight, Eye, FileText, RotateCcw, Send, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const STAGES: { key: string; label: string; icon: LucideIcon; caption: string }[] = [
  {
    key: "capture",
    label: "CAPTURE",
    icon: FileText,
    caption: "Consumption plan + requestor/project context captured at request time",
  },
  {
    key: "stitch",
    label: "STITCH",
    icon: Send,
    caption: "Reservation/PR → PO → GR → goods issue linked per line",
  },
  {
    key: "watch",
    label: "WATCH",
    icon: Eye,
    caption: "Aging engine on stock received but never issued",
  },
  {
    key: "act",
    label: "ACT",
    icon: Wrench,
    caption: "AI redeployment recommendations — advisory, human approves",
  },
]

export function LoopBanner() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon
          return (
            <div key={stage.key} className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.5px] text-foreground">
                  <Icon className="size-3.5 text-primary" />
                  {stage.label}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {stage.caption}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-dashed border-border pt-2.5">
        <RotateCcw className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          ACT closes the loop into CAPTURE — an accepted redeployment updates the
          next consumption plan instead of triggering a new buy.
        </p>
      </div>
    </div>
  )
}
