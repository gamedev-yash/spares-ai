import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AssistantChatWorkspace } from "@/components/chat/assistant-chat-workspace"
import { getChatSessionMessages } from "@/lib/api/chat"
import { ApiError } from "@/lib/api/client"
import { Skeleton } from "@/components/ui/skeleton"

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

  // A malformed id is a bad URL, not a lost conversation.
  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  let messages
  try {
    messages = await getChatSessionMessages(id)
  } catch (error) {
    // Chat sessions live in memory only (see csv_store.ChatStore) and do not survive a
    // backend restart, so a bookmarked or reloaded session URL routinely points at one
    // that is gone. That used to surface as a 500. Start a fresh conversation instead --
    // the URL is stale, not broken.
    if (error instanceof ApiError && error.status === 404) {
      redirect("/chat/assistant")
    }
    throw error
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      }
    >
      <AssistantChatWorkspace initialSessionId={id} initialMessages={messages} />
    </Suspense>
  )
}
