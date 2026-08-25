import { apiFetch } from "@/lib/api/client"

export interface ChatOption {
  id: string
  label: string
  description?: string | null
}

export interface AssistantMessage {
  id: number
  role: "user" | "assistant"
  text: string
  options: ChatOption[] | null
  created_at: string
}

export interface ChatResponse {
  session_id: number
  session_title: string
  message: AssistantMessage
  demo_mode: boolean
}

export interface ChatSessionSummary {
  id: number
  title: string
  status: string
  created_at: string
  updated_at: string
}

export function sendChatMessage(params: { sessionId?: number | null; message?: string; optionId?: string }): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/chat", {
    method: "POST",
    json: { session_id: params.sessionId ?? null, message: params.message ?? null, option_id: params.optionId ?? null },
  })
}

export function listChatSessions(): Promise<ChatSessionSummary[]> {
  return apiFetch<ChatSessionSummary[]>("/chat/sessions")
}

export function getChatSessionMessages(sessionId: number): Promise<AssistantMessage[]> {
  return apiFetch<AssistantMessage[]>(`/chat/sessions/${sessionId}/messages`)
}
