import { apiFetch } from "@/lib/api/client"
import type {
  FishboneRootCause,
  RootCauseTrendPoint,
  SituationDrillDownItem,
  SituationKpiSummary,
  VziAgingBucket,
} from "@/lib/types"

export function getAgingBuckets(): Promise<VziAgingBucket[]> {
  return apiFetch<VziAgingBucket[]>("/situation-analysis/aging")
}

export function getRootCauses(): Promise<FishboneRootCause[]> {
  return apiFetch<FishboneRootCause[]>("/situation-analysis/root-causes")
}

export function getRootCauseTrend(): Promise<RootCauseTrendPoint[]> {
  return apiFetch<RootCauseTrendPoint[]>("/situation-analysis/trend")
}

export function getDrillDownItems(): Promise<SituationDrillDownItem[]> {
  return apiFetch<SituationDrillDownItem[]>("/situation-analysis/drilldown")
}

export function getSituationKpiSummary(): Promise<SituationKpiSummary> {
  return apiFetch<SituationKpiSummary>("/situation-analysis/kpi-summary")
}
