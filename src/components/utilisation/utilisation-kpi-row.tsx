import { ArrowLeftRight, Gauge, PackageX, Unlink } from "lucide-react"

import type { UtilisationKpiSummary } from "@/lib/utilisation-data"
import { formatCount, formatZAR, formatZARMillions } from "@/lib/utils"

export function UtilisationKpiRow({ summary }: { summary: UtilisationKpiSummary }) {
  const cards = [
    {
      label: "GR'd-but-unissued value",
      icon: PackageX,
      figure: formatZARMillions(summary.unissuedValueZarMn),
      sub: "Received into stock, never issued to a job",
      danger: true,
    },
    {
      label: "30-day utilisation",
      icon: Gauge,
      figure: `${summary.utilisation30dPct}%`,
      sub: "Issued within 30 days of goods receipt",
    },
    {
      label: "Redeployment opportunities",
      icon: ArrowLeftRight,
      figure: formatCount(summary.redeploymentOpportunities.count),
      sub: `${formatZAR(summary.redeploymentOpportunities.valueZar)} in avoided new-buy`,
    },
    {
      label: "Broken chain links",
      icon: Unlink,
      figure: `${summary.brokenChainPct}%`,
      sub: "Reservation → PO → GR → issue lines that can't be stitched",
      danger: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              <Icon className="size-3.5" />
              {card.label}
            </div>
            <div
              className={
                "mt-2 text-2xl font-semibold " +
                (card.danger ? "text-destructive" : "text-foreground")
              }
            >
              {card.figure}
            </div>
            <div className="mt-1 text-xs leading-snug text-muted-foreground">
              {card.sub}
            </div>
          </div>
        )
      })}
    </div>
  )
}
