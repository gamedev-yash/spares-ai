import { Check, TrendingDown } from "lucide-react"

import { MarketBenchmark } from "@/components/chat/market-benchmark"
import { PriceDisplay } from "@/components/shared/price-display"
import type { ComparisonCardData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ComparisonCard({ data }: { data: ComparisonCardData }) {
  return (
    <div className="mt-1 rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
        <Check className="size-4 text-success" />
        {data.heading}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ComparisonSideCard side={data.current} tone="danger" />
        <ComparisonSideCard side={data.alternate} tone="success" accentBorder />
      </div>

      <MarketBenchmark
        low={data.benchmark.low}
        high={data.benchmark.high}
        note={data.benchmark.note}
      />
    </div>
  )
}

function ComparisonSideCard({
  side,
  tone,
  accentBorder = false,
}: {
  side: ComparisonCardData["current"]
  tone: "danger" | "success"
  accentBorder?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card p-2.5",
        accentBorder ? "border-2 border-primary" : "border border-transparent"
      )}
    >
      <div className="text-[11px] text-muted-foreground">{side.label}</div>
      <div className="my-1 text-[13px] font-medium text-foreground">
        {side.supplierName}
      </div>
      <div className="text-xs text-muted-foreground">{side.partNumber}</div>
      <PriceDisplay amount={side.price} tone={tone} size="lg" className="mt-1.5 block" />
      {side.savingsPct !== undefined ? (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-success">
          {side.savingsPct}% below current
          <TrendingDown className="size-3.5" />
        </div>
      ) : side.meta ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{side.meta}</div>
      ) : null}
    </div>
  )
}
