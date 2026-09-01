import { ArrowLeftRight, PackageX, Target, Unlink } from "lucide-react"

import type { UtilisationKpiSummary } from "@/lib/utilisation-data"
import { formatCount, formatZAR, formatZARMillions } from "@/lib/utils"

export function UtilisationKpis({ summary }: { summary: UtilisationKpiSummary }) {
  const cards = [
    {
      label: "Unutilised OAR position",
      icon: PackageX,
      figure: formatZARMillions(summary.unutilisedValueZarMn),
      sub: `${formatCount(summary.unutilisedLineCount)} lines received or issued, not yet confirmed used`,
      danger: true,
    },
    {
      label: "Plan compliance",
      icon: Target,
      figure: `${summary.planCompliancePct}%`,
      sub: `Consumed by plan date · ${summary.planCaptureCompletePct}% of RRs carry a complete consumption plan`,
    },
    {
      label: "Redeployment & avoidance",
      icon: ArrowLeftRight,
      figure: formatCount(summary.redeployment.count),
      sub: `${formatZAR(summary.redeployment.potentialAvoidanceZar)} potential avoidance — not yet realised`,
    },
    {
      label: "Ledger integrity exceptions",
      icon: Unlink,
      figure: `${summary.ledgerIntegrityExceptionPct}%`,
      sub: "Broken or awaiting-reconciliation lines — shared MRP allocations excluded",
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
