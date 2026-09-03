// Pure aggregate calculations over the mock recommendation dataset — kept
// separate from the data file so pages/selectors can share one source of
// derived numbers instead of recomputing ad hoc.

import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation, RecommendationStatus } from "@/features/initiative-7/types/inventory"

export const OPEN_STATUSES: RecommendationStatus[] = ["Pending Review", "In Approval", "Returned"]

export function isOpenRecommendation(rec: Recommendation): boolean {
  return OPEN_STATUSES.includes(rec.status)
}

export function countByCriticality(recs: Recommendation[] = RECOMMENDATIONS, level: Recommendation["criticality"]) {
  return recs.filter((r) => r.criticality === level).length
}

export function countAtStockoutRisk(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter((r) => r.risk === "high" || r.risk === "critical").length
}

export function countExcessCandidates(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter((r) => r.recommended.maxStock < r.current.maxStock).length
}

export function countAwaitingApproval(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs.filter(isOpenRecommendation).length
}

/** Net ZAR working-capital impact across every recommendation except
 * rejected ones (a rejected recommendation was never applied). */
export function netWorkingCapitalImpact(recs: Recommendation[] = RECOMMENDATIONS): number {
  return recs
    .filter((r) => r.status !== "Rejected")
    .reduce((sum, r) => sum + r.workingCapitalImpact, 0)
}

export function formatSignedZAR(amount: number): string {
  const sign = amount >= 0 ? "+" : "-"
  const abs = Math.round(Math.abs(amount))
  return `${sign}R ${abs.toLocaleString("en-US")}`
}

export function statusDistribution(recs: Recommendation[] = RECOMMENDATIONS) {
  const counts = new Map<RecommendationStatus, number>()
  for (const r of recs) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
}

export function circuitExposure(recs: Recommendation[] = RECOMMENDATIONS) {
  const map = new Map<string, { circuit: string; atRisk: number; healthy: number }>()
  for (const r of recs) {
    const entry = map.get(r.circuit) ?? { circuit: r.circuit, atRisk: 0, healthy: 0 }
    if (r.risk === "high" || r.risk === "critical") entry.atRisk += 1
    else entry.healthy += 1
    map.set(r.circuit, entry)
  }
  return Array.from(map.values())
}

export function deriveOverallHealth(recs: Recommendation[] = RECOMMENDATIONS): "healthy" | "attention" | "critical" {
  const criticalOpen = recs.filter(
    (r) => r.risk === "critical" && r.status !== "Implemented" && r.status !== "Rejected"
  ).length
  if (criticalOpen >= 2) return "critical"
  if (countAwaitingApproval(recs) > 0) return "attention"
  return "healthy"
}
