"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { RedeploymentRecommendation } from "@/lib/utilisation-data"
import { formatZAR } from "@/lib/utils"

type Decision = "accepted" | "dismissed"

export function RedeploymentCard({
  recommendations,
}: {
  recommendations: RedeploymentRecommendation[]
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  function decide(rec: RedeploymentRecommendation, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [rec.id]: decision }))
    if (decision === "accepted") {
      toast.success("Transfer recommendation sent for approval", {
        description: `${rec.description} — ${rec.idlePlant} → ${rec.demandPlant} (${rec.demandRef})`,
      })
    } else {
      toast(`Dismissed — ${rec.description}`)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1">
        <div className="text-sm font-medium text-foreground">
          Redeployment recommendations
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          ACT — idle stock at one plant matched against open demand at the other,
          instead of a new buy
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
                {rec.idleUnits} units idle at {rec.idlePlant} {rec.idleAgingDays}{" "}
                days · open demand at {rec.demandPlant} ({rec.demandRef}) →
                recommend inter-plant transfer, avoids new buy of{" "}
                {formatZAR(rec.avoidedBuyValue)}
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
                      onClick={() => decide(rec, "accepted")}
                    >
                      <Check className="size-3.5" />
                      Accept
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => decide(rec, "dismissed")}>
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
        Recommendations are advisory; stock transfers and postings remain SAP
        transactions executed by VZI.
      </p>
    </div>
  )
}
