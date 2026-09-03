import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ChatWorkspace } from "@/components/chat/chat-workspace"
import { searchMaterials } from "@/lib/api/materials"
import { createDraftSession, getMaterialById } from "@/lib/mock-data"

/**
 * Two populations of material code reach this route, and they do not overlap:
 *
 *  - the hand-authored ids in `mock-data.ts` (500-14892, 500-08823, ...), which back the
 *    scripted Initiative 10 alternate-sourcing prototype;
 *  - the generated catalogue in `backend/data/materials.csv` (500-100xx and the 80-series
 *    repairables), which is what every real screen lists.
 *
 * A real material has no scripted session to open -- Initiative 10 is a UI prototype, not a
 * running engine -- so rather than 404 (which is what the materials table used to hit for
 * every single row), send it to the assistant that can actually act on it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ materialId: string }>
}): Promise<Metadata> {
  const { materialId } = await params
  const material = getMaterialById(materialId)

  return {
    title: material
      ? `${material.description} — Spares AI`
      : "Material not found — Spares AI",
  }
}

async function isRealMaterial(code: string): Promise<boolean> {
  try {
    const result = await searchMaterials({ q: code, page_size: 1 })
    return result.items.some((m) => m.material_code === code)
  } catch {
    return false
  }
}

export default async function NewMaterialSessionPage({
  params,
}: {
  params: Promise<{ materialId: string }>
}) {
  const { materialId } = await params

  const mockMaterial = getMaterialById(materialId)
  if (mockMaterial) {
    const session = createDraftSession(mockMaterial)
    return <ChatWorkspace key={session.id} session={session} />
  }

  if (await isRealMaterial(materialId)) {
    redirect(`/chat/assistant?material=${encodeURIComponent(materialId)}`)
  }

  notFound()
}
