import type { Metadata } from "next"

import { UtilizationTable } from "@/components/utilization/utilization-table"

export const metadata: Metadata = {
  title: "Utilization Tracker — Spares AI",
}

export default function UtilizationPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Initiative 13 · Spares Utilization Tracking
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Utilization Tracker</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every OAR reservation line, end to end — from consumption plan through goods issue to
            confirmed use. Click a line to open its full lifecycle trace.
          </p>
        </div>
        <UtilizationTable />
      </div>
    </div>
  )
}
