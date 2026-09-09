import { VZI_AGING_COLORS } from "@/lib/constants"
import type { VziAgingBucket } from "@/lib/types"
import { formatCount } from "@/lib/utils"

export function AgingStrip({
  buckets,
  over30,
}: {
  buckets: VziAgingBucket[]
  over30: number
}) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const boundaryCount = buckets.slice(0, 3).reduce((sum, b) => sum + b.count, 0)
  const boundaryPct = (boundaryCount / total) * 100

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium text-foreground">
          PR aging at a glance
        </div>
        <div className="text-xs font-semibold text-destructive">
          {formatCount(over30)} PRs past the 30-day line
        </div>
      </div>

      <div className="relative mt-4 mb-1 h-6 w-full">
        <div className="flex h-full w-full overflow-hidden rounded-md bg-muted">
          {buckets.map((b, i) => (
            <div
              key={b.bucket}
              title={`${b.bucket} · ${formatCount(b.count)} PRs`}
              style={{
                width: `${(b.count / total) * 100}%`,
                backgroundColor: VZI_AGING_COLORS[i],
              }}
              className="h-full"
            />
          ))}
        </div>
        <div
          className="absolute top-0 h-full border-l-2 border-dashed border-foreground/60"
          style={{ left: `${boundaryPct}%` }}
        />
        <div
          className="absolute -top-4.5 -translate-x-1/2 text-[10px] font-medium text-foreground"
          style={{ left: `${boundaryPct}%` }}
        >
          30 d
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {buckets.map((b, i) => (
          <div key={b.bucket} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: VZI_AGING_COLORS[i] }}
            />
            {b.bucket} · {formatCount(b.count)}
          </div>
        ))}
      </div>
    </div>
  )
}
