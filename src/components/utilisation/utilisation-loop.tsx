import { ChevronRight, Eye, FileText, RotateCcw, Send, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const STAGES: { key: string; label: string; icon: LucideIcon; caption: string }[] = [
  {
    key: "capture",
    label: "CAPTURE",
    icon: FileText,
    caption: "Purpose, owner and consumption plan",
  },
  {
    key: "stitch",
    label: "STITCH",
    icon: Send,
    caption: "Reservation → PR → PO → GR → GI",
  },
  {
    key: "watch",
    label: "WATCH",
    icon: Eye,
    caption: "Plan breaches and unresolved utilisation",
  },
  {
    key: "act",
    label: "ACT",
    icon: Wrench,
    caption: "Confirm, re-plan, release or redeploy",
  },
]

export function UtilisationLoop({ onCaptureClick }: { onCaptureClick?: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon
          const isCapture = stage.key === "capture"
          const Wrapper = isCapture && onCaptureClick ? "button" : "div"
          return (
            <div key={stage.key} className="flex flex-1 items-center gap-2">
              <Wrapper
                type={isCapture && onCaptureClick ? "button" : undefined}
                onClick={isCapture ? onCaptureClick : undefined}
                className={cn(
                  "flex flex-1 flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-left",
                  isCapture &&
                    onCaptureClick &&
                    "cursor-pointer outline-none transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.5px] text-foreground">
                  <Icon className="size-3.5 text-primary" />
                  {stage.label}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {stage.caption}
                </p>
                {isCapture && onCaptureClick && (
                  <p className="text-[11px] font-medium text-primary">+ New OAR request</p>
                )}
              </Wrapper>
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
          ACT closes the loop into CAPTURE — a confirmed, re-planned or released
          line feeds straight back into the next consumption plan.
        </p>
      </div>
    </div>
  )
}
