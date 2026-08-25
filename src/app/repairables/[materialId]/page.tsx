import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RepairChainCard } from "@/components/repairables/repair-chain-card"
import { StockVsRepairChart } from "@/components/repairables/stock-vs-repair-chart"
import { EventTimeline } from "@/components/shared/event-timeline"
import { PageHeader } from "@/components/shared/page-header"
import { getExtendedMaterials } from "@/lib/material-data"
import {
  getChainsForMaterial,
  getDeclarationsForMaterial,
} from "@/lib/repairables-data"
import type { TimelineEvent } from "@/lib/types"

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
      ? `${material.description} — Repair chain — Spares AI`
      : "Repair chain — Spares AI",
  }
}

export default async function RepairChainDetailPage({
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
  const quantityUnderRepair = chains.reduce(
    (sum, c) => sum + c.quantityUnderRepair,
    0
  )

  const events: TimelineEvent[] = chains.flatMap((chain): TimelineEvent[] => [
    {
      id: `${chain.id}-dispatch`,
      label: `Dispatched to ${chain.vendor}`,
      timestamp: chain.dispatchDate,
      detail: `${chain.document.docNumber} · ${chain.quantityOut} units`,
      state: "done",
    },
    chain.status === "Received"
      ? {
          id: `${chain.id}-return`,
          label: "Returned",
          timestamp: chain.expectedDelivery,
          detail: `${chain.receivedQuantity} units received`,
          state: "done",
        }
      : {
          id: `${chain.id}-return`,
          label:
            chain.status === "Overdue" ? "Return overdue" : "Expected return",
          timestamp: chain.expectedDelivery,
          detail: `${chain.quantityUnderRepair} units still at vendor`,
          state: "active",
          tone: chain.status === "Overdue" ? "danger" : "default",
        },
  ])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PageHeader
          eyebrow="Repairables"
          title={material.description}
          description={`${materialId} · ${material.plant}`}
        />

        <StockVsRepairChart
          data={[
            {
              material: materialId,
              onHand: material.stockLevel,
              underRepair: quantityUnderRepair,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {chains.map((chain) => (
            <RepairChainCard key={chain.id} chain={chain} />
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            History
          </h2>
          <EventTimeline events={events} />
        </div>

        {declarations.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Past declarations
            </h2>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              {declarations.map((d) => (
                <div key={d.id}>
                  <span className="font-medium text-foreground">
                    {d.declaredBy}
                  </span>{" "}
                  on {d.declaredAt} — {d.decision}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
