import { Suspense } from "react"
import type { Metadata } from "next"

import { RepairRegisterTable } from "@/components/repair/repair-register-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Repair register — Spares AI",
}

export default function RepairRegisterPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Initiative 8 · Refurbishable spares
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">Repair register</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Every repairable part currently out at a vendor, with stock on hand and the
              reorder point beside it — so a repair in progress is visible before anyone
              orders the same part again.
            </p>
          </div>
          <StatusBadge tone="default" className="shrink-0">
            Computed from generated data
          </StatusBadge>
        </div>

        {/* Reads plant/status/search from the URL, so views are linkable from the
            approvals page and the duplicate alert. */}
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          }
        >
          <RepairRegisterTable />
        </Suspense>

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Repairable items are identified by the 80-series material code convention. A chain
          is open while a repair requisition or order is undelivered; quantity under repair is
          the ordered quantity less what has been received back. Rows highlighted in amber are
          at or below their reorder point while still at the vendor — the condition that
          produces a duplicate order.
        </p>
      </div>
    </div>
  )
}
