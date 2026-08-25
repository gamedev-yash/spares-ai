import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"

export interface NotificationEntry {
  id: number
  recipient_id: number
  type: string
  title: string
  message: string
  status: string
  related_entity_type: string | null
  related_entity_id: number | null
  created_at: string
  read_at: string | null
}

export interface NotificationSearchParams {
  status?: string
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export function searchNotifications(params: NotificationSearchParams = {}): Promise<Page<NotificationEntry>> {
  return apiFetch<Page<NotificationEntry>>("/notifications", { params })
}
