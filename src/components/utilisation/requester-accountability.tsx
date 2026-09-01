import { REQUESTER_ACCOUNTABILITY } from "@/lib/utilisation-data"
import { formatCount, formatZAR } from "@/lib/utils"

export function RequesterAccountability() {
  const rows = REQUESTER_ACCOUNTABILITY
  const max = Math.max(...rows.map((r) => r.unresolvedValueZar))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-medium text-foreground">
        Accountability exceptions by owner
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        Top 5 requesters/cost centres by unresolved utilisation value
      </div>
      <div className="mt-3.5 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={`${r.requester}-${r.costCentre}`} className="flex items-center gap-3">
            <div className="w-36 shrink-0">
              <div className="truncate text-xs font-medium text-foreground">
                {r.requester}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {r.department} · {r.costCentre}
              </div>
            </div>
            <div className="relative h-3.5 flex-1 rounded-xs bg-muted">
              <div
                className="h-full rounded-xs"
                style={{
                  width: `${(r.unresolvedValueZar / max) * 100}%`,
                  backgroundColor: "var(--chart-1)",
                }}
              />
            </div>
            <div className="w-32 shrink-0 text-right">
              <div className="text-xs font-medium tabular-nums text-foreground">
                {formatZAR(r.unresolvedValueZar)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatCount(r.openExceptions)} open · oldest {r.oldestOverdueDays}d
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
