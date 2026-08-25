"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AssistantMessageBubble } from "@/components/chat/assistant-message"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"
import { ApiError } from "@/lib/api/client"
import { sendChatMessage, type AssistantMessage } from "@/lib/api/chat"

const WELCOME_MESSAGE: AssistantMessage = {
  id: -1,
  role: "assistant",
  text: "Hi, I'm the Spares AI assistant. I can help you create a requisition, or look up open PRs/POs, cycle time, bottlenecks, and approval status. What do you need?",
  options: null,
  created_at: new Date(0).toISOString(),
}

export function AssistantChatWorkspace({
  initialSessionId,
  initialMessages,
}: {
  initialSessionId: number | null
  initialMessages: AssistantMessage[]
}) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId)
  const [title, setTitle] = useState("AI Assistant")
  const [messages, setMessages] = useState<AssistantMessage[]>(
    initialMessages.length > 0 ? initialMessages : [WELCOME_MESSAGE]
  )
  const [sending, setSending] = useState(false)
  const [demoMode, setDemoMode] = useState<boolean | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages.length])

  async function handleTurn(args: { message?: string; optionId?: string }) {
    setSending(true)
    if (args.message) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", text: args.message!, options: null, created_at: new Date().toISOString() },
      ])
    }
    try {
      const result = await sendChatMessage({ sessionId, ...args })
      setDemoMode(result.demo_mode)
      setTitle(result.session_title)
      setMessages((prev) => [...prev, result.message])
      if (sessionId === null) {
        setSessionId(result.session_id)
        router.replace(`/chat/assistant/${result.session_id}`)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reach the assistant.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChatHeader title={title} sessionId={sessionId != null ? String(sessionId) : "new"} />
      {demoMode && (
        <div className="border-b border-accent bg-accent/40 px-4 py-1.5 text-center text-[11px] text-muted-foreground">
          Demo mode — deterministic responses, not a real LLM. Set AI_MODE=provider to enable a real model.
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <AssistantMessageBubble
            key={message.id}
            message={message}
            disabled={sending || index !== messages.length - 1}
            onOptionSelect={(optionId) => handleTurn({ optionId })}
          />
        ))}
        {sending && <div className="text-xs text-muted-foreground">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <ChatInput onSend={(text) => handleTurn({ message: text })} />
    </div>
  )
}
