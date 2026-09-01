"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { RedeploymentRecommendations } from "@/components/utilisation/redeployment-recommendations"
import type { RedeploymentDecision } from "@/components/utilisation/redeployment-recommendations"
import { RequesterAccountability } from "@/components/utilisation/requester-accountability"
import { UtilisationAging } from "@/components/utilisation/utilisation-aging"
import { UtilisationCaptureDialog } from "@/components/utilisation/utilisation-capture-dialog"
import { UtilisationExceptions } from "@/components/utilisation/utilisation-exceptions"
import { UtilisationKpis } from "@/components/utilisation/utilisation-kpis"
import { UtilisationLedger } from "@/components/utilisation/utilisation-ledger"
import { UtilisationLoop } from "@/components/utilisation/utilisation-loop"
import { UtilisationSignals } from "@/components/utilisation/utilisation-signals"
import {
  applyExceptionResponse,
  applyRedeploymentAcceptance,
  computeUtilisationKpiSummary,
  createLedgerRowFromCapture,
  getRequesterExceptions,
  type CaptureRequestInput,
  type ExceptionResponseAction,
  type RedeploymentRecommendation,
  type UtilisationLedgerRow,
} from "@/lib/utilisation-data"

export function UtilisationWorkspace({
  initialLedger,
  recommendations,
}: {
  initialLedger: UtilisationLedgerRow[]
  recommendations: RedeploymentRecommendation[]
}) {
  const [ledger, setLedger] = useState<UtilisationLedgerRow[]>(initialLedger)
  const [recommendationDecisions, setRecommendationDecisions] = useState<
    Record<string, RedeploymentDecision>
  >({})
  const [captureOpen, setCaptureOpen] = useState(false)
  const [resolvedExceptionCount, setResolvedExceptionCount] = useState(0)
  const [resolvedExceptionValueZarMn, setResolvedExceptionValueZarMn] = useState(0)
  const [planCaptureBoostPct, setPlanCaptureBoostPct] = useState(0)

  const exceptions = useMemo(() => getRequesterExceptions(ledger), [ledger])
  const kpiSummary = useMemo(
    () =>
      computeUtilisationKpiSummary({
        recommendations,
        recommendationDecisions,
        resolvedExceptionCount,
        resolvedExceptionValueZarMn,
        planCaptureBoostPct,
      }),
    [recommendations, recommendationDecisions, resolvedExceptionCount, resolvedExceptionValueZarMn, planCaptureBoostPct]
  )

  function respondToException(
    ledgerRowId: string,
    action: ExceptionResponseAction,
    payload?: { newDate: string; reason: string }
  ) {
    const row = ledger.find((r) => r.id === ledgerRowId)
    if (!row) return

    setLedger((prev) =>
      prev.map((r) => (r.id === ledgerRowId ? applyExceptionResponse(r, action, payload) : r))
    )
    setResolvedExceptionCount((n) => n + 1)
    setResolvedExceptionValueZarMn((v) => v + row.valueZar / 1_000_000)

    if (action === "confirmed") {
      toast.success("Utilisation confirmation recorded", {
        description: `${row.materialDescription} — confirmed consumed by ${row.requester}`,
      })
    } else if (action === "released") {
      toast.success("Material released for redeployment review", {
        description: `${row.materialDescription} — flagged as a redeployment candidate`,
      })
    } else if (payload) {
      toast.success("Consumption plan updated", {
        description: `${row.materialDescription} — new planned date ${payload.newDate}`,
      })
    }
  }

  function decideRecommendation(rec: RedeploymentRecommendation, decision: RedeploymentDecision) {
    setRecommendationDecisions((prev) => ({ ...prev, [rec.id]: decision }))

    if (decision === "accepted") {
      if (rec.ledgerRowId) {
        setLedger((prev) =>
          prev.map((r) => (r.id === rec.ledgerRowId ? applyRedeploymentAcceptance(r) : r))
        )
      }
      const message =
        rec.actionType === "Inter-plant transfer"
          ? "Transfer recommendation sent for approval"
          : "Reuse recommendation sent for approval"
      toast.success(message, {
        description: `${rec.description} — ${rec.idlePlant} → ${rec.demandPlant} (${rec.demandRef})`,
      })
    } else {
      toast(`Dismissed — ${rec.description}`)
    }
  }

  function captureNewRequest(input: CaptureRequestInput) {
    const row = createLedgerRowFromCapture(input)
    setLedger((prev) => [row, ...prev])
    setPlanCaptureBoostPct((p) => Math.min(6, p + 0.3))
    setCaptureOpen(false)
    toast.success("Consumption plan captured", {
      description: `${row.materialDescription} — tracking ID ${row.trackingId}, planned ${row.plannedConsumptionDate}. Awaiting SAP reservation.`,
    })
  }

  return (
    <>
      <UtilisationLoop onCaptureClick={() => setCaptureOpen(true)} />
      <UtilisationKpis summary={kpiSummary} />

      <div className="min-w-0 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Reservation-to-Consumption Ledger
            </h2>
            <p className="text-xs text-muted-foreground">
              Per-line trace from reservation through PR, PO, GR and goods issue,
              anchored on RSNUM/RSPOS
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCaptureOpen(true)}>
            <Plus className="size-3.5" />
            New OAR request
          </Button>
        </div>
        <UtilisationLedger rows={ledger} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UtilisationAging />
        <RequesterAccountability />
      </div>

      <UtilisationExceptions exceptions={exceptions} onRespond={respondToException} />
      <RedeploymentRecommendations
        recommendations={recommendations}
        decisions={recommendationDecisions}
        onDecide={decideRecommendation}
      />
      <UtilisationSignals />

      <UtilisationCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onCapture={captureNewRequest}
      />
    </>
  )
}
