"use client"

import { useEffect, useRef } from "react"

import { ChatMessage } from "@/components/chat/chat-message"
import type { ChatMessage as ChatMessageData } from "@/lib/types"

export function ChatBody({
  messages,
  resolvedActions,
  onAction,
}: {
  messages: ChatMessageData[]
  resolvedActions: Record<string, string>
  onAction: (messageId: string, actionId: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          resolvedActionId={resolvedActions[message.id]}
          onAction={onAction}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}
