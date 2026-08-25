import { Check } from "lucide-react"

import type { TimelineEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

function TimelineDot({
  state,
  tone = "default",
}: {
  state: TimelineEvent["state"]
  tone?: "default" | "warning" | "danger"
}) {
  if (state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-3" />
      </span>
    )
  }

  if (state === "active") {
    return (
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          tone === "danger" && "bg-destructive/15 text-destructive",
          tone === "warning" && "bg-warning/15 text-warning",
          tone === "default" && "bg-accent text-accent-foreground"
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
      </span>
    )
  }

  return <span className="size-5 shrink-0 rounded-full border border-border" />
}

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => (
        <li key={event.id} className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <TimelineDot state={event.state} tone={event.tone} />
            {index < events.length - 1 && (
              <span className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className={cn("pb-4", index === events.length - 1 && "pb-0")}>
            <div
              className={cn(
                "text-sm",
                event.state === "pending"
                  ? "text-muted-foreground"
                  : "font-medium text-foreground"
              )}
            >
              {event.label}
            </div>
            {(event.timestamp || event.actor) && (
              <div className="text-xs text-muted-foreground">
                {[event.timestamp, event.actor].filter(Boolean).join(" · ")}
              </div>
            )}
            {event.detail && (
              <div className="mt-1 text-xs text-muted-foreground">
                {event.detail}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
