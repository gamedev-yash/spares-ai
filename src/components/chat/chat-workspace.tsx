"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ChatBody } from "@/components/chat/chat-body"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatInput } from "@/components/chat/chat-input"
import { RightPanel } from "@/components/layout/right-panel"
import type {
  ChatMessage as ChatMessageData,
  ChatSession,
  OptionGroupData,
} from "@/lib/types"
import { formatTime12h } from "@/lib/utils"

/** optionId is null for a group that's settled but was never actually
 * answered — e.g. a question that expired unanswered and triggered an
 * escalation. Still stops blocking the reveal cascade; just skips the
 * synthesized confirmation bubble since there's nothing to confirm. */
type ResolvedOption = { optionId: string | null; timestamp: string }

function seedResolvedOptionGroups(
  messages: ChatMessageData[]
): Record<string, ResolvedOption> {
  const seeded: Record<string, ResolvedOption> = {}
  for (const message of messages) {
    if (message.options?.locked) {
      seeded[message.options.id] = {
        optionId: message.options.defaultSelectedId ?? null,
        timestamp: message.options.resolvedAt ?? message.timestamp,
      }
    }
  }
  return seeded
}

/**
 * Reveals the script up to (and including) the first still-unanswered option
 * group, injecting a synthesized "you selected X" user bubble right after
 * each resolved one — answering a question is what makes the next turn
 * appear, rather than every message being present from the start.
 */
function computeVisibleMessages(
  messages: ChatMessageData[],
  resolvedOptionGroups: Record<string, ResolvedOption>
): ChatMessageData[] {
  const result: ChatMessageData[] = []
  for (const message of messages) {
    result.push(message)
    if (message.options) {
      const resolved = resolvedOptionGroups[message.options.id]
      if (!resolved) break
      if (resolved.optionId) {
        const chosen = message.options.options.find(
          (o) => o.id === resolved.optionId
        )
        result.push({
          id: `${message.options.id}-confirm`,
          role: "user",
          authorLabel: "You",
          timestamp: resolved.timestamp,
          text: chosen?.label ?? resolved.optionId,
        })
      }
    }
  }
  return result
}

export function ChatWorkspace({ session }: { session: ChatSession }) {
  const [resolvedOptionGroups, setResolvedOptionGroups] = useState<
    Record<string, ResolvedOption>
  >(() => seedResolvedOptionGroups(session.messages))
  const [extraMessages, setExtraMessages] = useState<ChatMessageData[]>([])
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

  const optionGroupsById = useMemo(() => {
    const map = new Map<string, OptionGroupData>()
    for (const message of session.messages) {
      if (message.options) map.set(message.options.id, message.options)
    }
    return map
  }, [session.messages])

  const visibleMessages = useMemo(
    () => computeVisibleMessages(session.messages, resolvedOptionGroups),
    [session.messages, resolvedOptionGroups]
  )
  const messages = [...visibleMessages, ...extraMessages]

  const resolvedOptionIds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(resolvedOptionGroups).map(([id, v]) => [id, v.optionId])
      ),
    [resolvedOptionGroups]
  )

  // Shared by both interaction paths — an option click and an action click
  // are each, in their own way, the user completing the current workflow
  // step. The chat action IS the approval trigger.
  function advanceWorkflow() {
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

  function handleOptionSelect(groupId: string, optionId: string) {
    if (resolvedOptionGroups[groupId]) return
    setResolvedOptionGroups((prev) => ({
      ...prev,
      [groupId]: { optionId, timestamp: formatTime12h(new Date()) },
    }))
    if (optionGroupsById.get(groupId)?.advancesWorkflow) {
      advanceWorkflow()
    }
  }

  function handleAction(messageId: string, actionId: string) {
    if (resolvedActions[messageId]) return
    setResolvedActions((prev) => ({ ...prev, [messageId]: actionId }))

    // "Proceed with alternate" is the one action that advances the workflow —
    // the chat action IS the approval trigger.
    if (actionId === "proceed") {
      advanceWorkflow()
      toast.success("Approval workflow triggered", {
        description: "Stakeholders have been notified.",
      })
    } else if (actionId === "export") {
      toast.success("Comparison report exported", {
        description: "PDF queued for engineering review.",
      })
    } else if (actionId === "view-technical") {
      toast("Showing technical equivalents", {
        description: "Filtered to alternates from other manufacturers.",
      })
    }
  }

  function handleSend(text: string) {
    setExtraMessages((prev) => [
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
          resolvedOptions={resolvedOptionIds}
          onOptionSelect={handleOptionSelect}
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
