import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"
import type { DuplicateContext } from "@/lib/api/repair"

/** Initiative 8: the declaration shown alongside the approval decision. */
export interface ApprovalAttestation {
  id: number
  status: "COMPLETE" | "PENDING" | null
  origin: "MANUAL" | "MRP" | "CHAT" | null
  statement: string | null
  declared_by_name: string | null
  declared_at: string | null
}

export interface ApprovalRecord {
  id: number
  approval_type: string
  entity_type: string
  rr_id: number | null
  pr_id: number | null
  po_id: number | null
  approval_level: number
  approver_id: number | null
  approver_role: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED"
  match_tier: string | null
  urgency: string | null
  submitted_at: string
  action_at: string | null
  comments: string | null
  rr_number: string | null
  requester_name: string | null
  material_description: string | null
  total_value: number | null
  // Initiative 8: duplicate context and the requisitioner's declaration travel with the
  // document, so the approver decides with both in view.
  duplicate_flag: boolean
  duplicate_context: DuplicateContext | null
  attestation: ApprovalAttestation | null
  /** Auto-raised requisition still awaiting a planner's declaration -- approval is blocked. */
  attestation_pending: boolean
}

export interface ApprovalSearchParams {
  status?: string
  urgency?: string
  approval_type?: string
  /** Matches requisition number, requester, material, approver role, type or urgency. */
  search?: string
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export function searchApprovals(params: ApprovalSearchParams = {}): Promise<Page<ApprovalRecord>> {
  return apiFetch<Page<ApprovalRecord>>("/approvals", { params })
}

export function approveApproval(id: number, comments?: string): Promise<ApprovalRecord> {
  return apiFetch<ApprovalRecord>(`/approvals/${id}/approve`, { method: "POST", json: { comments } })
}

export function rejectApproval(id: number, comments?: string): Promise<ApprovalRecord> {
  return apiFetch<ApprovalRecord>(`/approvals/${id}/reject`, { method: "POST", json: { comments } })
}

export function escalateApproval(id: number, comments?: string): Promise<ApprovalRecord> {
  return apiFetch<ApprovalRecord>(`/approvals/${id}/escalate`, { method: "POST", json: { comments } })
}
