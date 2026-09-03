import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ChatWorkspace } from "@/components/chat/chat-workspace"
import { OarCaptureWorkspace } from "@/components/chat/oar-capture-workspace"
import { OAR_CAPTURE_SESSION_ID } from "@/lib/constants"
import { getSessionById } from "@/lib/mock-data"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>
}): Promise<Metadata> {
  const { sessionId } = await params
  const session = getSessionById(sessionId)

  return {
    title: session
      ? `${session.title} — Spares AI`
      : "Session not found — Spares AI",
  }
}

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = getSessionById(sessionId)

  if (!session) {
    notFound()
  }

  if (session.id === OAR_CAPTURE_SESSION_ID) {
    return <OarCaptureWorkspace key={session.id} />
  }

  return <ChatWorkspace key={session.id} session={session} />
}
