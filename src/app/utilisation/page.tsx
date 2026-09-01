import type { Metadata } from "next"

import { StatusBadge } from "@/components/shared/status-badge"
import { IdleAgingCard } from "@/components/utilisation/idle-aging-card"
import { LedgerTable } from "@/components/utilisation/ledger-table"
import { LoopBanner } from "@/components/utilisation/loop-banner"
import { RedeploymentCard } from "@/components/utilisation/redeployment-card"
import { RequestorAccountabilityCard } from "@/components/utilisation/requestor-accountability-card"
import { UtilisationKpiRow } from "@/components/utilisation/utilisation-kpi-row"
import {
  REDEPLOYMENT_RECOMMENDATIONS,
  UTILISATION_LEDGER,
  getUtilisationKpiSummary,
} from "@/lib/utilisation-data"

export const metadata: Metadata = {
  title: "Spares Utilisation Tracking — Spares AI",
}

export default function UtilisationPage() {
  const summary = getUtilisationKpiSummary()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Vedanta Zinc International · Initiative 13
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              End-to-End Spares Utilisation Tracking
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Closing the loop from consumption plan to goods issue — capture,
              stitch, watch, and act on idle spares across Gamsberg and BMM.
            </p>
          </div>
          <StatusBadge tone="default" className="shrink-0">
            Mock data — advisory, human-gated
          </StatusBadge>
        </div>

        <LoopBanner />
        <UtilisationKpiRow summary={summary} />

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-medium text-foreground">
              Reservation-to-Consumption Ledger
            </h2>
            <p className="text-xs text-muted-foreground">
              Per-line trace from reservation/PR through PO, GR, and goods issue
            </p>
          </div>
          <LedgerTable rows={UTILISATION_LEDGER} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IdleAgingCard />
          <RequestorAccountabilityCard />
        </div>

        <RedeploymentCard recommendations={REDEPLOYMENT_RECOMMENDATIONS} />

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Illustrative figures, referenced against NMI &amp; SMI inventory ≈ ZAR
          148.7M and a 5% reuse target ≈ ZAR 7.4M. All values are mock data for
          this concept walkthrough.
        </p>
      </div>
    </div>
  )
}
