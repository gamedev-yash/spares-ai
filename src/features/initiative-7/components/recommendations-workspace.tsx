"use client"

import { useSearchParams } from "next/navigation"

import { AlertBanner } from "@/components/shared/alert-banner"
import { RecommendationsTable } from "@/features/initiative-7/components/recommendations-table"
import { RECOMMENDATIONS, getRecommendationsForMaterial } from "@/features/initiative-7/data/recommendations"

/**
 * Reads the optional `?reviewMaterial=<materialId>` query param — the exact
 * landing point Initiative 13 links to from its reclassification workflow
 * ("Review in Initiative 7"). Shows an advisory banner regardless of whether
 * a matching recommendation exists, and highlights/scrolls to the row when
 * one does.
 */
export function RecommendationsWorkspace() {
  const searchParams = useSearchParams()
  const reviewMaterial = searchParams.get("reviewMaterial")

  const matches = reviewMaterial ? getRecommendationsForMaterial(reviewMaterial) : []
  const highlightRecommendationId = matches[0]?.id

  return (
    <div className="flex flex-col gap-4">
      {reviewMaterial && (
        <AlertBanner tone="info" title={`Reviewing material flagged by OAR Utilization for reclassification review — ${reviewMaterial}`}>
          {matches.length > 0
            ? "A matching Inventory Optimization recommendation is highlighted below."
            : "No open Inventory Optimization recommendation exists yet for this material."}
        </AlertBanner>
      )}
      <RecommendationsTable
        recommendations={RECOMMENDATIONS}
        highlightRecommendationId={highlightRecommendationId}
      />
    </div>
  )
}
