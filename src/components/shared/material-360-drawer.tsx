"use client"

import Link from "next/link"
import { CircleDot } from "lucide-react"

import { DetailDrawer } from "@/components/shared/detail-drawer"
import { getInitiative7Material360Signal } from "@/features/initiative-7/selectors/material-360-adapter"
import { getInitiative8Material360Signal } from "@/features/initiative-8/selectors/material-360-adapter"
import { getInitiative13Material360Signal } from "@/features/initiative-13/selectors/material-360-adapter"
import type { Material360Signal, InitiativeHealth } from "@/lib/domain/contracts"
import { getMaterialById } from "@/lib/shared-data/material-catalog"
import { CHAT_SESSIONS, PENDING_APPROVALS } from "@/lib/mock-data"
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, formatZAR } from "@/lib/utils"

const STATUS_DOT: Record<InitiativeHealth | "neutral", string> = {
  healthy: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
  neutral: "text-muted-foreground",
}

function SignalSection({ signal }: { signal: Material360Signal }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <CircleDot className={cn("size-3", STATUS_DOT[signal.status])} />
          {signal.label}
        </span>
        <Link href={signal.href} className="text-[11px] text-primary hover:underline">
          Open
        </Link>
      </div>
      {signal.lines.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No active signal.</p>
      ) : (
        <dl className="space-y-0.5">
          {signal.lines.map((line) => (
            <div key={line.label} className="flex justify-between gap-2 text-[11px]">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * Global Material 360 drawer — composition only. Each initiative supplies a
 * `Material360Signal | null` via its own `selectors/material-360-adapter.ts`;
 * this component just lays out whatever comes back. It has no business
 * logic of its own beyond the small Initiative 9 inline read (open sessions
 * / pending approvals for the material), since Initiative 9 predates this
 * adapter pattern and has no `features/` module to own one.
 */
export function Material360Drawer() {
  const { openMaterialId, closeMaterial360 } = useMaterial360()
  const material = openMaterialId ? getMaterialById(openMaterialId) : undefined

  const initiative7Signal = openMaterialId
    ? getInitiative7Material360Signal(openMaterialId)
    : null
  const initiative8Signal = openMaterialId
    ? getInitiative8Material360Signal(openMaterialId)
    : null
  const initiative13Signal = openMaterialId
    ? getInitiative13Material360Signal(openMaterialId)
    : null

  const relatedSessions = openMaterialId
    ? CHAT_SESSIONS.filter((s) => s.materialId === openMaterialId)
    : []
  const relatedApprovals = openMaterialId
    ? PENDING_APPROVALS.filter((a) => a.materialId === openMaterialId)
    : []

  return (
    <DetailDrawer
      open={Boolean(openMaterialId)}
      onOpenChange={(open) => !open && closeMaterial360()}
      title={material ? material.description : (openMaterialId ?? "Material")}
      description={openMaterialId ?? undefined}
    >
      {!material ? (
        <p className="text-xs text-muted-foreground">
          No catalog record for this material — it may be initiative-specific mock data
          not in the shared catalog.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1.5 text-xs font-medium text-foreground">
              Procurement — Initiative 9
            </div>
            <dl className="space-y-0.5">
              <div className="flex justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="text-foreground">{material.category}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">Stock on hand</dt>
                <dd className="text-foreground">{material.stockLevel}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">Last PO price</dt>
                <dd className="text-foreground">{formatZAR(material.lastPoPrice)}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">Last vendor</dt>
                <dd className="text-foreground">{material.lastVendor}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[11px]">
                <dt className="text-muted-foreground">Lead time</dt>
                <dd className="text-foreground">{material.leadTimeDays} days</dd>
              </div>
            </dl>
            {(relatedSessions.length > 0 || relatedApprovals.length > 0) && (
              <div className="mt-2 flex flex-col gap-1 border-t border-dashed border-border pt-2">
                {relatedSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/chat/${s.id}`}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Open session #{s.id}
                  </Link>
                ))}
                {relatedApprovals.map((a) => (
                  <Link
                    key={a.id}
                    href="/approvals"
                    className="text-[11px] text-primary hover:underline"
                  >
                    Pending approval — {a.rrId}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {initiative7Signal && <SignalSection signal={initiative7Signal} />}
          {initiative8Signal && <SignalSection signal={initiative8Signal} />}
          {initiative13Signal && <SignalSection signal={initiative13Signal} />}
        </div>
      )}
    </DetailDrawer>
  )
}
