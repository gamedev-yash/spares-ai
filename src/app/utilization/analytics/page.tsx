import type { Metadata } from "next"

import { AnalyticsTabs } from "@/components/utilization/analytics-tabs"

export const metadata: Metadata = {
  title: "Utilization Analytics — Spares AI",
}

export default function UtilizationAnalyticsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Initiative 13 · Spares Utilization Tracking
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Utilization Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Unutilized OAR position, plan compliance, NM/SM inflow, redeployment savings, and
            reclassification candidates — computed live from the utilization ledger.
          </p>
        </div>
        <AnalyticsTabs />
      </div>
    </div>
  )
}
