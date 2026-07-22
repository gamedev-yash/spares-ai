import type { Metadata } from "next"

import { AuditLog } from "@/components/audit/audit-log"
import { getAuditLog } from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Audit trail — Spares AI",
}

export default function AuditPage() {
  const entries = getAuditLog()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Audit trail
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full traceability log across all sessions — every AI response and
            user selection.
          </p>
        </div>
        <AuditLog entries={entries} />
      </div>
    </div>
  )
}
