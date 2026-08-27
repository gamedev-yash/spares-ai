import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"

export type UtilizationStage =
  | "PLAN_CREATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "AVAILABLE_IN_STORES"
  | "ON_PR"
  | "ON_PO"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "ISSUED"
  | "AWAITING_CONFIRMATION"
  | "CONSUMED"
  | "DELAYED"
  | "AGED"
  | "RELEASED"
  | "REDEPLOYMENT_CANDIDATE"
  | "TRANSFERRED"
  | "CLOSED"

export type AgingSeverity = "Healthy" | "Due Soon" | "Due Today" | "Overdue" | "Critical"
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH"
export type FulfilmentLeg = "STORES" | "PROCUREMENT"

export interface UtilizationRecord {
  id: number
  tracking_id: string
  consumption_plan_id: number
  rr_id: number
  rr_number: string | null
  rr_line_id: number
  material_id: number
  material_code: string | null
  material_description: string | null
  plant: string
  department: string
  requester_id: number
  requester_name: string | null
  fulfilment_leg: FulfilmentLeg
  qty_requested: number
  qty_fulfilled: number
  qty_consumed: number
  pr_id: number | null
  pr_number: string | null
  po_id: number | null
  po_number: string | null
  stage: UtilizationStage
  planned_consumption_date: string
  actual_consumption_date: string | null
  replan_count: number
  previous_planned_date: string | null
  replan_reason: string | null
  release_reason: string | null
  risk_score: number | null
  risk_level: RiskLevel | null
  risk_drivers: string[]
  historical: boolean
  created_at: string
  updated_at: string
  days_until_planned: number | null
  days_past_plan: number | null
  aging_severity: AgingSeverity
  shared_allocation: boolean
}

export interface ConsumptionPlan {
  id: number
  rr_id: number
  rr_line_id: number
  reservation_number: string
  reservation_type: "JOB_CARD" | "STRAIGHT"
  material_id: number
  plant: string
  department: string
  requester_id: number
  quantity: number
  purpose: string
  job_card_number: string | null
  project: string | null
  equipment: string | null
  criticality: string
  planned_consumption_date: string
  notes: string | null
  created_at: string
}

export interface UtilizationEvent {
  id: number
  tracking_id: string
  stage: string
  status: string
  quantity: number | null
  actor_id: number | null
  actor_name: string | null
  source: string
  note: string | null
  timestamp: string
}

export interface Escalation {
  id: number
  tracking_id: string
  level: "REQUESTER" | "HOD1" | "HOD2" | "HOD3" | "INVENTORY_CONTROL"
  owner_id: number
  owner_name?: string | null
  waiting_since: string
  reminder_count: number
  status: "ACTIVE" | "RESOLVED"
  escalated_at: string | null
  chain?: Escalation[]
}

export interface ApprovalSummary {
  level: number
  role: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED"
  approver_name: string | null
  action_at: string | null
}

export interface UtilizationDetail extends UtilizationRecord {
  plan: ConsumptionPlan | null
  events: UtilizationEvent[]
  sibling_legs: UtilizationRecord[]
  consolidated_with: UtilizationRecord[]
  escalation: Escalation | null
  approval: ApprovalSummary | null
}

export interface UtilizationListParams {
  plant?: string
  department?: string
  requester_id?: number
  stage?: string
  risk_level?: string
  aging_severity?: string
  mine_only?: boolean
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export function listUtilization(params: UtilizationListParams = {}): Promise<Page<UtilizationRecord>> {
  return apiFetch<Page<UtilizationRecord>>("/utilization", { params })
}

export function getUtilizationDetail(id: number): Promise<UtilizationDetail> {
  return apiFetch<UtilizationDetail>(`/utilization/${id}`)
}

export function confirmConsumed(id: number, actualDate: string, comment?: string): Promise<UtilizationDetail> {
  return apiFetch<UtilizationDetail>(`/utilization/${id}/confirm-consumed`, {
    method: "POST",
    json: { actual_date: actualDate, comment },
  })
}

export function replanUtilization(id: number, newPlannedDate: string, reason: string): Promise<UtilizationDetail> {
  return apiFetch<UtilizationDetail>(`/utilization/${id}/replan`, {
    method: "POST",
    json: { new_planned_date: newPlannedDate, reason },
  })
}

export function releaseUtilization(id: number, reason: string): Promise<UtilizationDetail> {
  return apiFetch<UtilizationDetail>(`/utilization/${id}/release`, {
    method: "POST",
    json: { reason },
  })
}

export interface UtilizationException {
  id: number
  tracking_id: string
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  plant: string
  department: string
  requester_id: number
  requester_name: string | null
  status: "OPEN" | "RESOLVED"
  created_at: string
  resolved_at: string | null
  note: string | null
  material_description: string | null
}

export interface ExceptionListParams {
  plant?: string
  department?: string
  requester_id?: number
  type?: string
  severity?: string
  status?: string
  page?: number
  page_size?: number
  [key: string]: string | number | undefined
}

export function listExceptions(params: ExceptionListParams = {}): Promise<Page<UtilizationException>> {
  return apiFetch<Page<UtilizationException>>("/utilization/exceptions", { params })
}

export function resolveException(id: number, note?: string): Promise<UtilizationException> {
  return apiFetch<UtilizationException>(`/utilization/exceptions/${id}/resolve`, { method: "POST", json: { note } })
}

export interface RedeploymentRecommendation {
  id: number
  requested_tracking_id: string | null
  requested_material_id: number
  requested_material_description: string | null
  requested_qty: number
  requested_plant: string
  match_type: "EXACT" | "TIER1" | "TIER2"
  unused_stock_id: number | null
  matched_material_id: number
  matched_material_description: string | null
  matched_plant: string
  matched_qty: number
  avoided_value: number
  decision: "PENDING" | "USE_EXISTING" | "TRANSFER" | "PURCHASE"
  decision_by: number | null
  decision_at: string | null
  created_at: string
}

export function listRedeploymentRecommendations(params: { decision?: string; plant?: string } = {}): Promise<RedeploymentRecommendation[]> {
  return apiFetch<RedeploymentRecommendation[]>("/utilization/redeployment/recommendations", { params })
}

export function decideRedeployment(id: number, decision: "USE_EXISTING" | "TRANSFER" | "PURCHASE"): Promise<RedeploymentRecommendation> {
  return apiFetch<RedeploymentRecommendation>(`/utilization/redeployment/${id}/decision`, { method: "POST", json: { decision } })
}

export interface UnusedStockItem {
  id: number
  material_id: number
  material_code: string | null
  material_description: string | null
  plant: string
  quantity: number
  source: "RELEASED" | "HISTORICAL"
  source_tracking_id: string | null
  status: "AVAILABLE" | "TRANSFERRED" | "CONSUMED"
  created_at: string
}

export function listUnusedStock(params: { plant?: string; status?: string } = {}): Promise<UnusedStockItem[]> {
  return apiFetch<UnusedStockItem[]>("/utilization/unused-stock", { params })
}

export interface UnmatchedIssue {
  id: number
  material_id: number
  material_description: string | null
  plant: string
  quantity: number
  issue_date: string
  suggested_tracking_id: string | null
  confidence: number | null
  signals: string[]
  status: "PENDING" | "CONFIRMED" | "REJECTED"
  resolved_at: string | null
}

export function listUnmatchedIssues(params: { status?: string } = {}): Promise<UnmatchedIssue[]> {
  return apiFetch<UnmatchedIssue[]>("/utilization/unmatched-issues", { params })
}

export function resolveUnmatchedIssue(id: number, action: "CONFIRM" | "REJECT"): Promise<UnmatchedIssue> {
  return apiFetch<UnmatchedIssue>(`/utilization/unmatched-issues/${id}/resolve`, { method: "POST", json: { action } })
}

export interface UtilizationDashboard {
  unutilizedPosition: {
    kpis: {
      unutilizedOarValue: number
      unutilizedOarLines: number
      overdueValue: number
      criticalExceptions: number
      releasedForRedeployment: number
    }
    byAgeBucket: { bucket: string; value: number }[]
    byDepartment: { department: string; value: number }[]
    byPlant: { plant: string; value: number }[]
    topMaterials: { material: string; value: number }[]
  }
  planCompliance: {
    kpis: {
      completePlansPct: number
      onTimeConsumptionPct: number
      replanRatePct: number
      confirmationCompliancePct: number
      avgDaysPastPlan: number
    }
    byDepartment: { department: string; compliancePct: number }[]
    trend: { month: string; planned: number; actual: number }[]
    replanReasons: { reason: string; count: number }[]
    requesterRanking: { requester: string; overdueCount: number }[]
  }
  nmSmInflow: {
    kpis: { newlyAgedValue: number; riskValue: number; avoidedValue: number }
    monthlyInflow: { month: string; value: number }[]
  }
  redeployment: {
    kpis: {
      purchaseAvoidanceValue: number
      transfersRecommended: number
      transfersAccepted: number
      releasedStockValue: number
      exactMatches: number
      approvedAlternateMatches: number
    }
    recommendations: RedeploymentRecommendation[]
  }
  reclassification: {
    candidates: {
      material_id: number
      material_code: string
      description: string
      plant: string
      annual_consumption_events: number
      annual_quantity: number
      current_oar_status: string
      suggested_action: string
      confidence: number
    }[]
  }
  insights: string[]
}

export function getUtilizationDashboard(): Promise<UtilizationDashboard> {
  return apiFetch<UtilizationDashboard>("/utilization/dashboard")
}

export interface StockMatch {
  match_type: "EXACT" | "TIER1" | "TIER2"
  plant: string
  material_id: number
  material_code: string
  description: string
  quantity: number
  unused_stock_id: number | null
}

export interface StockCheckResult {
  requested_material_id: number
  requested_quantity: number
  matches: StockMatch[]
  estimated_avoided_value: number
}

export function stockCheck(materialId: number, plant: string, quantity: number): Promise<StockCheckResult> {
  return apiFetch<StockCheckResult>("/utilization/stock-check", { params: { material_id: materialId, plant, quantity } })
}

export interface RiskAssessment {
  score: number
  level: RiskLevel
  drivers: string[]
}

export function assessRisk(materialId: number, plant: string, department: string, quantity: number): Promise<RiskAssessment> {
  return apiFetch<RiskAssessment>("/utilization/risk", { params: { material_id: materialId, plant, department, quantity } })
}

export function classifyMaterial(materialId: number): Promise<{ material_id: number; classification: "OAR" | "Stocked"; reason: string }> {
  return apiFetch("/utilization/classify", { params: { material_id: materialId } })
}
