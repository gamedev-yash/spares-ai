"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  AttestationQueue,
  type AttestationInput,
} from "@/components/refurbishables/attestation-queue"
import { DetectionCard } from "@/components/refurbishables/detection-card"
import { RepairKpiRow } from "@/components/refurbishables/repair-kpi-row"
import { RepairRegister } from "@/components/refurbishables/repair-register"
import { DashboardCard } from "@/components/dashboard/dashboard-card"
import {
  AGING_AMBER_DAYS,
  AGING_RED_DAYS,
  type CodingCandidate,
  type DetectionSummary,
  type RefurbishableItem,
} from "@/lib/refurbishables-data"
import { formatDateDMY } from "@/lib/utils"

export function RefurbishablesWorkspace({
  items: seedItems,
  detection,
  candidates,
}: {
  items: RefurbishableItem[]
  detection: DetectionSummary
  candidates: CodingCandidate[]
}) {
  // Local-only: attestations are held in component state for the mockup, so a
  // refresh returns the register to its seeded position.
  const [items, setItems] = useState<RefurbishableItem[]>(seedItems)

  function completeAttestation(id: string, input: AttestationInput) {
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return

    setItems((prev) =>
      prev.map((current): RefurbishableItem =>
        current.id === id
          ? {
              ...current,
              attested: true,
              stage: "Attested",
              attestedOn: formatDateDMY(new Date()),
              stripBy: input.stripBy,
              conditionNotes: input.conditionNotes,
            }
          : current
      )
    )

    toast.success(`Attestation recorded — ${item.materialCode}`, {
      description: `${item.description} · strip/assess by ${input.stripBy}. Register advanced to "Attested" — held on the platform, no SAP posting.`,
    })
  }

  return (
    <>
      <RepairKpiRow items={items} />

      <DashboardCard
        title="Repair status register"
        subtitle="Serialised 80-series items in the refurbishment loop — removal through to back in stock, mirrored from SAP."
        footnote={`Days out counts from the removal date and freezes at total turnaround once the item is booked back into stock. Aging flags at ${AGING_AMBER_DAYS} and ${AGING_RED_DAYS} days.`}
      >
        <RepairRegister items={items} />
      </DashboardCard>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <DashboardCard
          title="Attestation queue"
          subtitle="Removals blocked from the repair loop until the responsible user completes a condition-to-repair declaration."
          span={6}
          footnote="Submitting records the declaration on the platform and advances the register stage. No SAP posting is made."
        >
          <AttestationQueue items={items} onAttest={completeAttestation} />
        </DashboardCard>

        <DashboardCard
          title="80-series material code detection"
          subtitle={detection.scanNote}
          span={6}
          footnote="Candidates are advisory and routed to master data for review — the platform does not change material coding."
        >
          <DetectionCard summary={detection} candidates={candidates} />
        </DashboardCard>
      </div>
    </>
  )
}
