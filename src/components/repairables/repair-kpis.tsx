import type { RepairKpiSummary } from "@/lib/types"
import { cn, formatCount, formatZARMillions } from "@/lib/utils"

export function RepairKpis({ summary }: { summary: RepairKpiSummary }) {
  const cards = [
    {
      label: "Items currently out for repair",
      figure: formatCount(summary.itemsOutForRepair),
      sub: `${formatCount(summary.unitsAtVendors)} units at vendors`,
    },
    {
      label: "Value out for repair",
      figure: formatZARMillions(summary.valueOutForRepair / 1_000_000),
      sub: "Across all open repair chains",
    },
    {
      label: "Chains overdue",
      figure: formatCount(summary.chainsOverdue),
      sub: "Past their expected return date",
      danger: summary.chainsOverdue > 0,
    },
    {
      label: "Declarations pending",
      figure: formatCount(summary.declarationsPending),
      sub: "Attestations not yet captured",
      danger: summary.declarationsPending > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {card.label}
          </div>
          <div
            className={cn(
              "mt-1.5 text-2xl font-semibold",
              card.danger ? "text-destructive" : "text-foreground"
            )}
          >
            {card.figure}
          </div>
          <div className="mt-1 text-xs leading-snug text-muted-foreground">
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
