import type { Metadata } from "next"

import { RefurbishablesWorkspace } from "@/components/refurbishables/refurbishables-workspace"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  CODING_CANDIDATES,
  DETECTION_SUMMARY,
  REFURBISHABLE_ITEMS,
} from "@/lib/refurbishables-data"

export const metadata: Metadata = {
  title: "Refurbishable Spares Register — Spares AI",
}

export default function RefurbishablesPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Vedanta Zinc International · Initiative 8
            </div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              Refurbishable spares tracking
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Gamsberg &amp; Black Mountain Mining (BMM) — 80-series code
              detection, condition-to-repair attestation, and the repair status
              register per serialised item.
            </p>
          </div>
          <StatusBadge tone="default" className="shrink-0">
            Read-only register — no SAP write-backs
          </StatusBadge>
        </div>

        <RefurbishablesWorkspace
          items={REFURBISHABLE_ITEMS}
          detection={DETECTION_SUMMARY}
          candidates={CODING_CANDIDATES}
        />

        <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
          Register is platform-held and read-only over SAP. Repair POs, goods
          movements and material coding remain SAP transactions executed by VZI.
        </p>
      </div>
    </div>
  )
}
