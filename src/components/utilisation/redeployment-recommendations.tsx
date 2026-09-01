"use client"

import { Check, X } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { PLANT_ABBR, type RedeploymentRecommendation } from "@/lib/utilisation-data"
import { formatZAR } from "@/lib/utils"

export type RedeploymentDecision = "accepted" | "dismissed"

function recommendationText(rec: RedeploymentRecommendation): string {
  const action =
    rec.actionType === "Inter-plant transfer"
      ? `recommend an inter-plant transfer to ${rec.demandPlant} (${PLANT_ABBR[rec.demandPlant]})`
      : rec.actionType === "Store draw"
        ? "recommend a store draw instead of a new purchase"
        : "recommend a reuse review before approving a new purchase"

  const source =
    rec.sourceType === "Approved alternate (Initiative 10)"
      ? `Approved Tier 1 alternate for ${rec.alternateOfMaterialCode} — `
      : ""

  return `${source}${rec.idleUnits} units idle at ${rec.idlePlant} (${PLANT_ABBR[rec.idlePlant]}) ${rec.idleAgingDays} days · open demand under ${rec.demandRef} → ${action}, avoids a new buy of ${formatZAR(rec.avoidedBuyValue)}`
}

export function RedeploymentRecommendations({
  recommendations,
  decisions,
  onDecide,
}: {
  recommendations: RedeploymentRecommendation[]
  decisions: Record<string, RedeploymentDecision>
  onDecide: (rec: RedeploymentRecommendation, decision: RedeploymentDecision) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1">
        <div className="text-sm font-medium text-foreground">
          Redeployment &amp; pre-order intelligence
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          ACT — duplicate demand and unused stock checked against the
          Initiative 10 matching engine before a new purchase is approved
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {recommendations.map((rec) => {
          const decision = decisions[rec.id]
          return (
            <div
              key={rec.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-3 last:pb-0"
            >
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
                <span className="font-medium">{rec.description}</span>:{" "}
                {recommendationText(rec)}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone="default">{rec.confidencePct}% confidence</StatusBadge>
                {decision ? (
                  <StatusBadge tone={decision === "accepted" ? "success" : "default"}>
                    {decision === "accepted" ? "Sent for approval" : "Dismissed"}
                  </StatusBadge>
                ) : (
                  <>
                    <Button
                      size="xs"
                      variant="outline"
                      className="border-success/40 text-success hover:bg-success/10"
                      onClick={() => onDecide(rec, "accepted")}
                    >
                      <Check className="size-3.5" />
                      Accept
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => onDecide(rec, "dismissed")}>
                      <X className="size-3.5" />
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground italic">
        Recommendations are advisory. Stock issues, transfers, reservation
        changes and other inventory postings remain SAP transactions executed
        by authorised VZI users.
      </p>
    </div>
  )
}
