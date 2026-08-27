import type { Metadata } from "next"

import { RedeploymentPanel } from "@/components/utilization/redeployment-panel"

export const metadata: Metadata = {
  title: "Redeployment — Spares AI",
}

export default function RedeploymentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Initiative 13 · Spares Utilization Tracking
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Redeployment &amp; Released Stock</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Unused stock recommended for reuse before a new purchase is made — AI recommends, a human
            decides. Includes cross-plant matches and unreferenced goods-issue reconciliation.
          </p>
        </div>
        <RedeploymentPanel />
      </div>
    </div>
  )
}
