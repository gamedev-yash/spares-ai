import type { Metadata } from "next"

import { AssistantChatWorkspace } from "@/components/chat/assistant-chat-workspace"
import { getChatSessionMessages } from "@/lib/api/chat"

export const metadata: Metadata = {
  title: "AI Assistant — Spares AI",
}

export default async function AssistantChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const id = Number(sessionId)
  const messages = await getChatSessionMessages(id)

  return <AssistantChatWorkspace initialSessionId={id} initialMessages={messages} />
}
