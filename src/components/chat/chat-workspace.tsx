"use client"

import { useState } from "react"

import { ChatBody } from "@/components/chat/chat-body"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"
import { RightPanel } from "@/components/layout/right-panel"
import type { ChatSession } from "@/lib/types"
import { formatTime12h } from "@/lib/utils"

export function ChatWorkspace({ session }: { session: ChatSession }) {
  const [messages, setMessages] = useState(session.messages)
  const [workflow, setWorkflow] = useState(session.workflow)
  const [emails, setEmails] = useState(session.emails)
  const [trace, setTrace] = useState(session.trace)
  const [resolvedActions, setResolvedActions] = useState<
    Record<string, string>
  >(() => {
    const seeded: Record<string, string> = {}
    for (const message of session.messages) {
      if (message.actions?.resolvedActionId) {
        seeded[message.id] = message.actions.resolvedActionId
      }
    }
    return seeded
  })
  const [activeTab, setActiveTab] = useState("workflow")

  function handleAction(messageId: string, actionId: string) {
    if (resolvedActions[messageId]) return
    setResolvedActions((prev) => ({ ...prev, [messageId]: actionId }))

    // "Proceed with alternate" is the one action that advances the workflow —
    // the chat action IS the approval trigger.
    if (actionId === "proceed") {
      setWorkflow((prev) => {
        const activeIndex = prev.findIndex((step) => step.status === "active")
        if (activeIndex === -1) return prev
        return prev.map((step, index) => {
          if (index === activeIndex) {
            return { ...step, status: "done" as const, meta: "Just now" }
          }
          if (index === activeIndex + 1) {
            return {
              ...step,
              status: "active" as const,
              meta: "Awaiting response",
            }
          }
          return step
        })
      })
      setTrace((prev) => ({
        ...prev,
        selectionsDone: Math.min(prev.selectionsDone + 1, prev.selectionsTotal),
      }))
      setEmails((prev) =>
        prev.map((email) =>
          email.status === "pending"
            ? { ...email, status: "sent" as const, time: "Just now" }
            : email
        )
      )
    }
  }

  function handleSend(text: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${prev.length}`,
        role: "user" as const,
        authorLabel: "You",
        timestamp: formatTime12h(new Date()),
        text,
      },
    ])
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader title={session.title} sessionId={session.id} />
        <ChatBody
          messages={messages}
          resolvedActions={resolvedActions}
          onAction={handleAction}
        />
        <ChatInput onSend={handleSend} />
      </div>
      <RightPanel
        workflow={workflow}
        emails={emails}
        trace={trace}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}
