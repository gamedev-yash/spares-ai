import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"

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
}

export interface ApprovalSearchParams {
  status?: string
  urgency?: string
  approval_type?: string
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
