import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"

export interface AuditLogEntry {
  id: number
  user_id: number | null
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  timestamp: string
  ip_address: string | null
}

export interface AuditSearchParams {
  entity_type?: string
  action?: string
  user_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export function searchAuditLogs(params: AuditSearchParams = {}): Promise<Page<AuditLogEntry>> {
  return apiFetch<Page<AuditLogEntry>>("/audit", { params })
}
