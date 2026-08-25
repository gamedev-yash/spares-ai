import { apiFetch } from "@/lib/api/client"

export interface CycleTimeTrendPoint {
  month: string
  average_days: number
  count: number
}

export interface CycleTime {
  sample_size: number
  average_days: number | null
  median_days: number | null
  p90_days: number | null
  p95_days: number | null
  stage_wise_avg_days: Record<string, number>
  bottleneck_stage: string | null
  trend: CycleTimeTrendPoint[]
}

export interface BottleneckStage {
  stage_code: string
  average_duration_days: number
  transaction_count: number
  delayed_transaction_count: number
  delayed_pct: number
  pct_contribution_to_total_delay: number
}

export interface DashboardSummary {
  open_pr_count: number
  open_po_count: number
  open_pr_value: number
  open_po_value: number
  average_cycle_time_days: number | null
  bottleneck_stage: string | null
  prs_over_30_days: number
  top_bottleneck_stages: BottleneckStage[]
}

export function getCycleTime(): Promise<CycleTime> {
  return apiFetch<CycleTime>("/analytics/cycle-time")
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/analytics/dashboard-summary")
}
