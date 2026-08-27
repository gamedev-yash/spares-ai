import type { Metadata } from "next"

import { ExceptionsTable } from "@/components/utilization/exceptions-table"

export const metadata: Metadata = {
  title: "Utilization Exceptions — Spares AI",
}

export default function UtilizationExceptionsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Initiative 13 · Spares Utilization Tracking
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Utilization Exceptions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Overdue confirmations, unresponsive requesters, repeated re-plans, and other items that
            need a human decision before they turn into slow/non-moving stock.
          </p>
        </div>
        <ExceptionsTable />
      </div>
    </div>
  )
}
