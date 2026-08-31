/**
 * The Initiative-7 workflow deliberately separates two responsibilities across two pages:
 *   Recommendations -- understand what the system recommends, then "Send for Approval"
 *   Approvals        -- make the business decision: Approve / Adjust / Reject
 * This file is the shared state model both pages read/write through InventoryProvider, so
 * a decision made on one page is immediately visible on the other (same in-memory entry).
 * Session-only -- deliberately not persisted, resets on refresh, no backend write-back.
 */

export type ApprovalStatus = "NEEDS_REVIEW" | "IN_APPROVAL" | "APPROVED" | "ADJUSTED" | "REJECTED"

// Record<string, ...> (not Record<ApprovalStatus, ...>) so generic UI helpers (Select's
// labelFor, table cells) can index it with a plain string without a cast -- same pattern
// as RISK_META/STATUS_COLOR in ui/colors.ts.
export const STATUS_DISPLAY: Record<string, string> = {
  NEEDS_REVIEW: "Needs Review",
  IN_APPROVAL: "In Review",
  APPROVED: "Approved",
  ADJUSTED: "Adjusted",
  REJECTED: "Rejected",
}

export const APPROVAL_CHAIN = [
  "END_USER",
  "ENGINEERING_MANAGER",
  "COMMERCIAL_MANAGER",
  "WAREHOUSE_SUPERVISOR",
] as const
export type ApprovalStage = (typeof APPROVAL_CHAIN)[number]

export const APPROVAL_STAGE_LABELS: Record<ApprovalStage, string> = {
  END_USER: "End User",
  ENGINEERING_MANAGER: "Engineering Manager",
  COMMERCIAL_MANAGER: "Commercial Manager",
  WAREHOUSE_SUPERVISOR: "Warehouse Supervisor",
}

export type AdjustableField = "SafetyStock" | "ROP" | "MaxStock"
export const ADJUSTABLE_FIELD_LABELS: Record<AdjustableField, string> = {
  SafetyStock: "Safety Stock",
  ROP: "Reorder Point",
  MaxStock: "Max Stock",
}

/** One entry in the audit trail -- rendered everywhere a decision is shown as
 * "AI recommended {recommended} -> {by} changed {field} to {adjusted} -- Reason: {reason}". */
export interface AdjustmentRecord {
  field: AdjustableField
  recommended: number
  adjusted: number
  reason: string
  by: string
  at: string
}

export interface ApprovalEntry {
  materialId: string
  status: ApprovalStatus
  stageIndex: number // only meaningful while status === "IN_APPROVAL"
  sentAt: string | null
  sentBy: string | null
  adjustments: AdjustmentRecord[]
  rejectionReason: string | null
  decidedBy: string | null
  decidedAt: string | null
}

export function defaultApprovalEntry(materialId: string): ApprovalEntry {
  return {
    materialId,
    status: "NEEDS_REVIEW",
    stageIndex: 0,
    sentAt: null,
    sentBy: null,
    adjustments: [],
    rejectionReason: null,
    decidedBy: null,
    decidedAt: null,
  }
}
