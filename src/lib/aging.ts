import { VZI_AGING_COLORS } from "@/lib/constants"
import { daysStuckTone, type SeverityTone } from "@/lib/utils"

export type AgingBucketDef = {
  id: string
  label: string
  minDays: number
  maxDays?: number
}

// Mirrors the 7 aging buckets already used by the Situation Analysis
// dashboard (vzi_situation_analysis.csv's "aging" section) and
// VZI_AGING_COLORS, so every module shares one bucket vocabulary.
export const AGING_BUCKETS: AgingBucketDef[] = [
  { id: "0-7", label: "0-7 days", minDays: 0, maxDays: 7 },
  { id: "7-15", label: "7-15 days", minDays: 8, maxDays: 15 },
  { id: "15-30", label: "15-30 days", minDays: 16, maxDays: 30 },
  { id: "30-60", label: "30-60 days", minDays: 31, maxDays: 60 },
  { id: "60-90", label: "60-90 days", minDays: 61, maxDays: 90 },
  { id: "90-120", label: "90-120 days", minDays: 91, maxDays: 120 },
  { id: "120+", label: "More than 120 days", minDays: 121 },
]

export function bucketForDays(days: number): AgingBucketDef {
  return (
    AGING_BUCKETS.find(
      (b) => days >= b.minDays && (b.maxDays === undefined || days <= b.maxDays)
    ) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1]
  )
}

export function agingColorForBucket(bucketId: string): string {
  const index = AGING_BUCKETS.findIndex((b) => b.id === bucketId)
  return index >= 0
    ? VZI_AGING_COLORS[index]
    : VZI_AGING_COLORS[VZI_AGING_COLORS.length - 1]
}

export function agingTone(days: number): SeverityTone {
  return daysStuckTone(days)
}
