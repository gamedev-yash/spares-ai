import type { Metadata } from "next"

import { StatusBadge } from "@/components/shared/status-badge"
import { UtilisationWorkspace } from "@/components/utilisation/utilisation-workspace"
import { REDEPLOYMENT_RECOMMENDATIONS, UTILISATION_LEDGER } from "@/lib/utilisation-data"

export const metadata: Metadata = {
  title: "Spares Utilisation Tracking — Spares AI",
}

export default function UtilisationPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Vedanta Zinc International · Initiative 13
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              Spares Utilisation Tracking
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Reservation-to-consumption traceability, aging intelligence and
              exception-based accountability for OAR materials at Gamsberg and
              Black Mountain.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge tone="default">Mock data — advisory, human-gated</StatusBadge>
            <p className="text-[11px] text-muted-foreground">
              SAP transactions remain read-only from this workspace.
            </p>
          </div>
        </div>

        <UtilisationWorkspace
          initialLedger={UTILISATION_LEDGER}
          recommendations={REDEPLOYMENT_RECOMMENDATIONS}
        />

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Illustrative figures for this concept walkthrough. SAP ECC remains the
          system of record; the platform is read-only against it for this
          initiative — no goods issues, transfers, reservation changes or
          material-master updates are posted from here.
        </p>
      </div>
    </div>
  )
}
