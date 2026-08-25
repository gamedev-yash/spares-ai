import { apiFetch } from "@/lib/api/client"
import type {
  VziCategoryPivotRow,
  VziCategoryRow,
  VziFlag,
  VziKpiSummary,
  VziOarVbAggregate,
  VziOarVbRow,
  VziPoAreaRow,
  VziPoDetailRow,
  VziPrSummaryRow,
  VziUnitAggregate,
} from "@/lib/types"

export interface VziDashboard {
  kpiSummary: VziKpiSummary
  prSummary: VziPrSummaryRow[]
  aging: { bucket: string; count: number }[]
  oarVb: VziOarVbRow[]
  oarVbByUnit: Record<string, VziOarVbAggregate>
  categories: VziCategoryRow[]
  categoryPivot: VziCategoryPivotRow[]
  poSummary: VziPrSummaryRow[]
  poDetail: VziPoDetailRow[]
  poByUnit: Record<string, VziUnitAggregate>
  poAreaSorted: VziPoAreaRow[]
  slideNotes: string[]
  derivedNotes: string[]
  flags: VziFlag[]
}

export function getVziDashboard(): Promise<VziDashboard> {
  return apiFetch<VziDashboard>("/vzi/dashboard")
}
