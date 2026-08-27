import type { AgingSeverity, RiskLevel, UtilizationStage } from "@/lib/api/utilization"

type Tone = "default" | "success" | "warning" | "danger"

export const STAGE_LABELS: Record<UtilizationStage, string> = {
  PLAN_CREATED: "Plan Created",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  AVAILABLE_IN_STORES: "Available in Stores",
  ON_PR: "On PR",
  ON_PO: "On PO",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Received",
  ISSUED: "Issued",
  AWAITING_CONFIRMATION: "Awaiting Confirmation",
  CONSUMED: "Consumed",
  DELAYED: "Delayed",
  AGED: "Aged",
  RELEASED: "Released",
  REDEPLOYMENT_CANDIDATE: "Redeployment Candidate",
  TRANSFERRED: "Transferred",
  CLOSED: "Closed",
}

export const STAGE_TONE: Record<UtilizationStage, Tone> = {
  PLAN_CREATED: "default",
  PENDING_APPROVAL: "default",
  APPROVED: "default",
  AVAILABLE_IN_STORES: "success",
  ON_PR: "default",
  ON_PO: "default",
  IN_TRANSIT: "default",
  RECEIVED: "default",
  ISSUED: "default",
  AWAITING_CONFIRMATION: "warning",
  CONSUMED: "success",
  DELAYED: "warning",
  AGED: "danger",
  RELEASED: "warning",
  REDEPLOYMENT_CANDIDATE: "warning",
  TRANSFERRED: "success",
  CLOSED: "default",
}

export const AGING_TONE: Record<AgingSeverity, Tone> = {
  Healthy: "success",
  "Due Soon": "default",
  "Due Today": "warning",
  Overdue: "warning",
  Critical: "danger",
}

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
}

export const EXCEPTION_SEVERITY_TONE: Record<string, Tone> = {
  LOW: "default",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "danger",
}

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  CONSUMPTION_OVERDUE: "Consumption overdue",
  ISSUED_UNCONFIRMED: "Issued but unconfirmed",
  NO_RESPONSE: "Requester did not respond",
  REPEATED_REPLAN: "Repeated re-planning",
  RELEASED_AWAITING_REDEPLOYMENT: "Released stock awaiting redeployment",
  MANUAL_ISSUE_UNMATCHED: "Manual issue unmatched",
  HIGH_RISK: "High NM/SM risk",
  CONSOLIDATED_PR_REVIEW: "Consolidated PR allocation review",
  MISSING_PURPOSE: "Missing purpose",
  MISSING_LINKAGE: "Missing project/equipment linkage",
  OAR_ANOMALY: "OAR classification anomaly",
}

export function formatQty(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}
