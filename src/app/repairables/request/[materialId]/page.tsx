import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RepairRequestWorkspace } from "@/components/repairables/repair-request-workspace"
import { getExtendedMaterials } from "@/lib/material-data"
import {
  getChainsForMaterial,
  getDeclarationsForMaterial,
  getRepairVsNewEvaluation,
} from "@/lib/repairables-data"

function loadMaterial(materialId: string) {
  return getExtendedMaterials().find((m) => m.id === materialId)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ materialId: string }>
}): Promise<Metadata> {
  const { materialId } = await params
  const material = loadMaterial(materialId)
  return {
    title: material
      ? `Guarded request — ${material.description} — Spares AI`
      : "Guarded request — Spares AI",
  }
}

export default async function RepairRequestPage({
  params,
}: {
  params: Promise<{ materialId: string }>
}) {
  const { materialId } = await params
  const material = loadMaterial(materialId)

  if (!material) {
    notFound()
  }

  const chains = getChainsForMaterial(materialId)
  const declarations = getDeclarationsForMaterial(materialId)
  const evaluation = getRepairVsNewEvaluation(materialId)

  return (
    <RepairRequestWorkspace
      material={material}
      chains={chains}
      evaluation={evaluation}
      declarations={declarations}
    />
  )
}
