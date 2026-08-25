import type { Metadata } from "next"

import { AttestationLog } from "@/components/repairables/attestation-log"
import { PageHeader } from "@/components/shared/page-header"
import { getDeclarations } from "@/lib/repairables-data"

export const metadata: Metadata = {
  title: "Attestation log — Spares AI",
}

export default function RepairablesAuditPage() {
  const entries = getDeclarations()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PageHeader
          eyebrow="Repairables"
          title="Attestation log"
          description="Every condition-to-repair declaration captured during this session."
        />
        <AttestationLog entries={entries} />
      </div>
    </div>
  )
}
