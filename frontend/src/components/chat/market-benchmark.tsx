import { Info } from "lucide-react"

import { formatZAR } from "@/lib/utils"

export function MarketBenchmark({
  low,
  high,
  note,
}: {
  low: number
  high: number
  note: string
}) {
  return (
    <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-accent px-2.5 py-2 text-[12px] text-accent-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Market index benchmark: <strong>{formatZAR(low)}</strong> –{" "}
        <strong>{formatZAR(high)}</strong> for this spec. {note}
      </span>
    </div>
  )
}
