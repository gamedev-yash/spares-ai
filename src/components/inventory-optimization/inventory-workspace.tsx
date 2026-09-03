"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ChangeProposalExport } from "@/components/inventory-optimization/change-proposal-export"
import {
  RecommendationWorkbench,
  type SessionDecisions,
} from "@/components/inventory-optimization/recommendation-workbench"
import {
  OPEN_PROPOSAL_ID,
  workingCapitalDeltaZar,
  type ChangeProposalBatch,
  type ParameterRecommendation,
  type RecommendationDecision,
} from "@/lib/inventory-optimization-data"

/**
 * Holds the planner's decisions for the browser session and feeds them to both
 * the workbench and the change-proposal card, so an approval visibly lands in
 * the open draft batch. Nothing is persisted and nothing leaves the browser —
 * a refresh returns every row to its authored state.
 */
export function InventoryWorkspace({
  recommendations,
  batches,
}: {
  recommendations: ParameterRecommendation[]
  batches: ChangeProposalBatch[]
}) {
  const [decisions, setDecisions] = useState<SessionDecisions>({})
  const [statusMessage, setStatusMessage] = useState("")

  const sessionApproved = recommendations.filter(
    (recommendation) => decisions[recommendation.id]?.decision === "Approved"
  )
  const sessionApprovedValueZar = sessionApproved.reduce(
    (sum, recommendation) => sum + workingCapitalDeltaZar(recommendation),
    0
  )

  function handleDecide(
    recommendation: ParameterRecommendation,
    decision: RecommendationDecision,
    comment: string
  ) {
    if (decisions[recommendation.id]) return
    setDecisions((prev) => ({
      ...prev,
      [recommendation.id]: { decision, comment },
    }))

    if (decision === "Approved") {
      toast.success(
        `Added to change proposal ${OPEN_PROPOSAL_ID} — pending SAP mass maintenance`,
        { description: `${recommendation.materialId} · ${recommendation.description}` }
      )
      setStatusMessage(
        `${recommendation.materialId} approved and added to change proposal ${OPEN_PROPOSAL_ID}, pending SAP mass maintenance.`
      )
    } else {
      toast.error(`Recommendation rejected — ${recommendation.materialId}`, {
        description:
          "Current SAP parameters retained; the comment stays on the review record.",
      })
      setStatusMessage(
        `${recommendation.materialId} rejected. Current SAP parameters retained.`
      )
    }
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">
          Recommended inventory changes
        </h2>
        <p className="text-xs text-muted-foreground">
          {recommendations.length} materials reviewed for the Sep 2026 planning
          cycle. Open a row to see the recommendation.
        </p>
        <div className="mt-3">
          <RecommendationWorkbench
            recommendations={recommendations}
            decisions={decisions}
            onDecide={handleDecide}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">
          Change proposal export
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Approved parameter changes batched for the SAP mass-maintenance
          process.
        </p>
        <ChangeProposalExport
          batches={batches}
          sessionApprovedCount={sessionApproved.length}
          sessionApprovedValueZar={sessionApprovedValueZar}
        />
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </>
  )
}
