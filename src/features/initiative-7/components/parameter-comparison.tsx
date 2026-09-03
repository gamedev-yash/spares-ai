import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { StockParameters } from "@/features/initiative-7/types/inventory"

const ROWS: { key: keyof StockParameters; label: string }[] = [
  { key: "rop", label: "Reorder Point (ROP)" },
  { key: "safetyStock", label: "Safety Stock" },
  { key: "maxStock", label: "Maximum Stock" },
]

/** Side-by-side "Current parameters" vs "Recommended parameters" panel. */
export function ParameterComparison({
  current,
  recommended,
}: {
  current: StockParameters
  recommended: StockParameters
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="mb-2 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Current parameters
        </div>
        <dl className="flex flex-col gap-2">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium text-foreground tabular-nums">{current[row.key]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 text-[11px] font-medium tracking-[0.5px] text-primary uppercase">
          Recommended parameters
        </div>
        <dl className="flex flex-col gap-2">
          {ROWS.map((row) => {
            const changed = current[row.key] !== recommended[row.key]
            const up = recommended[row.key] > current[row.key]
            return (
              <div key={row.key} className="flex items-baseline justify-between">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="flex items-center gap-1 text-sm font-semibold text-foreground tabular-nums">
                  {recommended[row.key]}
                  {changed && (
                    <span className={cn("flex items-center text-[10px]", up ? "text-warning" : "text-success")}>
                      <ArrowRight className={cn("size-3", up ? "-rotate-45" : "rotate-45")} />
                    </span>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </div>
  )
}
