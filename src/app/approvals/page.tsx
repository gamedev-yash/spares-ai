import type { Metadata } from "next"

import { ApprovalsTable } from "@/components/approvals/approvals-table"
import { PENDING_APPROVALS } from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Pending approvals — Spares AI",
}

export default function ApprovalsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Pending approvals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Procurement decisions waiting across all active sessions.
          </p>
        </div>
        <ApprovalsTable approvals={PENDING_APPROVALS} />
      </div>
    </div>
  )
}
