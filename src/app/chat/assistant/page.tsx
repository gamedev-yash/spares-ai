import { Suspense } from "react"
import type { Metadata } from "next"

import { AssistantChatWorkspace } from "@/components/chat/assistant-chat-workspace"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "AI Assistant — Spares AI",
}

export default function NewAssistantChatPage() {
  return (
    // Reads ?material= so a material row can land here ready to act on that part.
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-2/3" />
          <Skeleton className="mt-auto h-12 w-full" />
        </div>
      }
    >
      <AssistantChatWorkspace initialSessionId={null} initialMessages={[]} />
    </Suspense>
  )
}
