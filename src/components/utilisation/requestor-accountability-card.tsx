import { TOP_REQUESTORS_BY_UNISSUED } from "@/lib/utilisation-data"
import { formatZAR } from "@/lib/utils"

export function RequestorAccountabilityCard() {
  const rows = TOP_REQUESTORS_BY_UNISSUED
  const max = Math.max(...rows.map((r) => r.unissuedValueZar))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-medium text-foreground">
        Top requestors by unissued value
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        Where GR&apos;d-but-unissued stock is concentrated
      </div>
      <div className="mt-3.5 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={`${r.requestor}-${r.costCentre}`} className="flex items-center gap-3">
            <div className="w-36 shrink-0">
              <div className="truncate text-xs font-medium text-foreground">
                {r.requestor}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {r.costCentre}
              </div>
            </div>
            <div className="relative h-3.5 flex-1 rounded-xs bg-muted">
              <div
                className="h-full rounded-xs"
                style={{
                  width: `${(r.unissuedValueZar / max) * 100}%`,
                  backgroundColor: "var(--chart-1)",
                }}
              />
            </div>
            <div className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
              {formatZAR(r.unissuedValueZar)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
