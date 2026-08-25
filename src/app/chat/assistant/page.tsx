import type { Metadata } from "next"

import { AssistantChatWorkspace } from "@/components/chat/assistant-chat-workspace"

export const metadata: Metadata = {
  title: "AI Assistant — Spares AI",
}

export default function NewAssistantChatPage() {
  return <AssistantChatWorkspace initialSessionId={null} initialMessages={[]} />
}
