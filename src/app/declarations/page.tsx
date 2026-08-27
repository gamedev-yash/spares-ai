import { Suspense } from "react"
import type { Metadata } from "next"

import { AttestationPanel } from "@/components/repair/attestation-panel"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Condition-to-repair declarations — Spares AI",
}

export default function DeclarationsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Initiative 8 · Refurbishable spares
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Condition-to-repair declarations
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A new requisition for a repairable part requires a declaration that the existing
            item cannot be repaired. Requisitioners declare at creation; automatically raised
            requisitions wait here for a planner, and cannot be approved until they are cleared.
          </p>
        </div>

        {/* Reads ?material / ?plant / ?rr / ?tab so the register and the approvals page can
            link straight to the item that needs declaring. */}
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          }
        >
          <AttestationPanel />
        </Suspense>
      </div>
    </div>
  )
}
