import type { VziKpiSummary } from "@/lib/types"
import { formatCount, formatZARMillions } from "@/lib/utils"

export function KpiRow({ summary }: { summary: VziKpiSummary }) {
  const cards = [
    {
      label: "Open PRs",
      figure: formatCount(summary.openPr.total),
      sub: `${formatCount(summary.openPr.material)} material · ${formatCount(summary.openPr.service)} service`,
    },
    {
      label: "Open POs",
      figure: formatCount(summary.openPo.total),
      sub: `${formatCount(summary.openPo.material)} material · ${formatCount(summary.openPo.service)} service`,
    },
    {
      label: "Open PO value",
      figure: formatZARMillions(summary.openPoValue.total),
      sub: `${summary.servicePct}% sits in service POs`,
    },
    {
      label: "PRs older than 30 days",
      figure: formatCount(summary.prOver30),
      sub: `${summary.prOver30Pct}% of all open PRs`,
      danger: true,
    },
    {
      label: "Care & maintenance POs",
      figure: formatCount(summary.careMaintenance.total),
      sub: `${formatCount(summary.careMaintenance.material)} material · ${formatCount(summary.careMaintenance.service)} service (mining)`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {card.label}
          </div>
          <div
            className={
              "mt-1.5 text-2xl font-semibold " +
              (card.danger ? "text-destructive" : "text-foreground")
            }
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
