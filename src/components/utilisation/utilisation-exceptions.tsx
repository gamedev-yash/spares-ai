"use client"

import { useState } from "react"
import { Check, Clock, RotateCw } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  PLANT_ABBR,
  type ExceptionResponseAction,
  type RequesterException,
} from "@/lib/utilisation-data"

export function UtilisationExceptions({
  exceptions,
  onRespond,
}: {
  exceptions: RequesterException[]
  onRespond: (
    ledgerRowId: string,
    action: ExceptionResponseAction,
    payload?: { newDate: string; reason: string }
  ) => void
}) {
  const [replanTarget, setReplanTarget] = useState<RequesterException | null>(null)
  const [replanDate, setReplanDate] = useState("")
  const [replanReason, setReplanReason] = useState("")

  function openReplan(item: RequesterException) {
    setReplanTarget(item)
    setReplanDate("")
    setReplanReason("")
  }

  function submitReplan() {
    if (!replanTarget || !replanDate || !replanReason.trim()) return
    onRespond(replanTarget.ledgerRowId, "delayed", {
      newDate: replanDate,
      reason: replanReason.trim(),
    })
    setReplanTarget(null)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1">
        <div className="text-sm font-medium text-foreground">
          Exception response workflow
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          WATCH → ACT — planned consumption dates that have passed without a
          confirmed outcome
        </div>
      </div>
      {exceptions.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No open exceptions — every aging line has a confirmed outcome.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {exceptions.map((item) => (
            <div
              key={item.ledgerRowId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-3 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground">
                  {item.materialCode} · {item.description}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.plant} ({PLANT_ABBR[item.plant]}) · Planned consumption:{" "}
                  {item.plannedConsumptionDate} · Requester: {item.requester}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone="warning" className="normal-case">
                  {item.statusLabel}
                </StatusBadge>
                <Button
                  size="xs"
                  variant="outline"
                  className="border-success/40 text-success hover:bg-success/10"
                  onClick={() => onRespond(item.ledgerRowId, "confirmed")}
                >
                  <Check className="size-3.5" />
                  Confirm consumed
                </Button>
                <Button size="xs" variant="outline" onClick={() => openReplan(item)}>
                  <RotateCw className="size-3.5" />
                  Re-plan
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => onRespond(item.ledgerRowId, "released")}
                >
                  <Clock className="size-3.5" />
                  No longer required
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground italic">
        Non-response escalates through the reservation&apos;s own HOD approval
        chain, then to inventory control — the same authority that approved the
        original request. Resolving a line here updates it in the ledger above.
      </p>

      <Dialog open={replanTarget !== null} onOpenChange={(open) => !open && setReplanTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-plan consumption date</DialogTitle>
            <DialogDescription>
              {replanTarget?.description} — recorded in the audit trail with a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                New planned consumption date
              </label>
              <Input
                type="date"
                value={replanDate}
                onChange={(e) => setReplanDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Reason for the delay
              </label>
              <Input
                type="text"
                placeholder="e.g. shutdown window moved to next outage"
                value={replanReason}
                onChange={(e) => setReplanReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!replanDate || !replanReason.trim()} onClick={submitReplan}>
              Save new plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
