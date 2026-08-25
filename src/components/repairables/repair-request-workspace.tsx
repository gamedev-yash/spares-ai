"use client"

import { useState } from "react"
import { toast } from "sonner"

import { DeclarationForm } from "@/components/repairables/declaration-form"
import { DuplicateGuardAlert } from "@/components/repairables/duplicate-guard-alert"
import { RepairVsNewComparison } from "@/components/repairables/repair-vs-new-comparison"
import { AdvisoryNotice } from "@/components/shared/advisory-notice"
import { ContextPanel } from "@/components/shared/context-panel"
import { DecisionControls } from "@/components/shared/decision-controls"
import { PageHeader } from "@/components/shared/page-header"
import type { ExtendedMaterial } from "@/lib/material-data"
import type {
  ConditionAttestation,
  DecisionOption,
  RepairChain,
  RepairVsNewEvaluation,
} from "@/lib/types"

const DECISION_OPTIONS: DecisionOption[] = [
  {
    id: "proceed",
    icon: "check-circle",
    label: "Proceed",
    description: "Raise the new PR despite the open repair chain.",
    tone: "success",
  },
  {
    id: "wait",
    icon: "clock",
    label: "Wait",
    description: "Hold off until the repaired units return.",
  },
  {
    id: "cancel",
    icon: "alert-triangle",
    label: "Cancel",
    description: "Cancel this PR -- the repair chain already covers the need.",
  },
]

export function RepairRequestWorkspace({
  material,
  chains,
  evaluation,
  declarations,
  prNumber,
}: {
  material: ExtendedMaterial
  chains: RepairChain[]
  evaluation: RepairVsNewEvaluation | undefined
  declarations: ConditionAttestation[]
  prNumber?: string
}) {
  const [activeTab, setActiveTab] = useState("detail")
  const [resolvedId, setResolvedId] = useState<string | undefined>(undefined)
  const [declared, setDeclared] = useState(false)

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <PageHeader
            eyebrow="Repairables — guarded request"
            title={material.description}
            description={`${material.id} · ${material.plant}`}
          />

          <AdvisoryNotice kind="not-a-block" />

          <DuplicateGuardAlert chains={chains} />

          {evaluation && <RepairVsNewComparison evaluation={evaluation} />}

          <DeclarationForm
            materialId={material.id}
            prNumber={prNumber}
            onSubmit={({ confirmed, note }) => {
              setDeclared(true)
              toast.success(`Declaration captured for ${material.id}`, {
                description: confirmed ? note : undefined,
              })
            }}
          />

          <DecisionControls
            options={DECISION_OPTIONS}
            resolvedId={resolvedId}
            onDecide={(id) => {
              setResolvedId(id)
              toast(`Decision recorded: ${id}`)
            }}
            accentId="proceed"
          />
        </div>
      </div>

      <ContextPanel
        details={[
          ["Material", material.id],
          ["Plant", material.plant],
          ["Criticality", material.criticalityClass ?? "—"],
          ["Stock on hand", String(material.stockLevel)],
          ["Past declarations", String(declarations.length)],
          ["This declaration", declared ? "Captured" : "Not yet captured"],
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}
