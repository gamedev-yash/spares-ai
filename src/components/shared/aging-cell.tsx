import { StatusBadge } from "@/components/shared/status-badge"
import { cn, daysStuckTone, type SeverityTone } from "@/lib/utils"

const TEXT_TONE: Record<SeverityTone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
}

export function AgingCell({
  days,
  bucket,
}: {
  days: number
  bucket?: string
}) {
  const tone = daysStuckTone(days)
  return (
    <div>
      <div className={cn("font-medium tabular-nums", TEXT_TONE[tone])}>
        {days} {days === 1 ? "day" : "days"}
      </div>
      {bucket && (
        <div className="text-[11px] text-muted-foreground">{bucket}</div>
      )}
    </div>
  )
}

export function AgingBadge({
  days,
  bucket,
}: {
  days: number
  bucket?: string
}) {
  const tone = daysStuckTone(days)
  return <StatusBadge tone={tone}>{bucket ?? `${days}d`}</StatusBadge>
}
