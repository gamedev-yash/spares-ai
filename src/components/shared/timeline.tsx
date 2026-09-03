import { cn } from "@/lib/utils"

export interface TimelineEvent {
  id: string
  label: string
  timestamp: string
  description?: string
  tone?: "default" | "success" | "warning" | "danger"
}

const DOT_CLASSES: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

/**
 * Generic vertical event timeline — repair chains, RR->GI document flows,
 * aging-exception escalation paths all render through this one component.
 */
export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[]
  className?: string
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < events.length - 1 && (
            <span className="absolute top-3 left-[5px] h-full w-px bg-border" aria-hidden />
          )}
          <span
            className={cn(
              "mt-1 size-[11px] shrink-0 rounded-full ring-4 ring-card",
              DOT_CLASSES[event.tone ?? "default"]
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{event.label}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {event.timestamp}
              </span>
            </div>
            {event.description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
