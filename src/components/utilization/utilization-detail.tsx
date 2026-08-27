"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Check, Clock, RotateCcw, XCircle } from "lucide-react"
import { toast } from "sonner"

import { ApprovalStepper } from "@/components/workflow/approval-stepper"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import {
  confirmConsumed,
  getUtilizationDetail,
  releaseUtilization,
  replanUtilization,
  type UtilizationDetail,
  type UtilizationRecord,
} from "@/lib/api/utilization"
import { AGING_TONE, RISK_TONE, STAGE_LABELS, STAGE_TONE, formatQty } from "@/lib/utilization-format"
import type { WorkflowStepData } from "@/lib/types"

const REPLAN_REASONS = ["Shutdown postponed", "Equipment not available", "Scope changed", "Project delayed", "Maintenance rescheduled", "Other"]
const TERMINAL_STAGES = new Set(["CONSUMED", "RELEASED", "TRANSFERRED", "CLOSED"])

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Builds the visual pipeline shown by the reused ApprovalStepper — deliberately two
 * different shapes depending on whether this leg was fulfilled from stores or required
 * procurement, so a stores-fulfilled line never shows MRP/PR/PO/GR as applicable steps. */
function buildLifecycleSteps(detail: UtilizationDetail): WorkflowStepData[] {
  const isStores = detail.fulfilment_leg === "STORES"
  const approvalStatus = detail.approval?.status
  const approved = approvalStatus === "APPROVED"
  const fulfilled = detail.qty_fulfilled > 0
  const terminal = TERMINAL_STAGES.has(detail.stage)
  const overdue = detail.aging_severity === "Overdue" || detail.aging_severity === "Critical"
  const dueSoon = detail.aging_severity === "Due Soon" || detail.aging_severity === "Due Today"

  const steps: WorkflowStepData[] = [
    { id: "rr", label: "RR Created", status: "done", meta: detail.rr_number ?? undefined },
    {
      id: "plan",
      label: detail.historical ? "Consumption Plan" : "Consumption Plan Captured",
      status: detail.historical ? "pending" : "done",
      meta: detail.historical ? "Historical — no original plan on file" : detail.plan?.purpose,
      tone: detail.historical ? "warning" : undefined,
    },
  ]

  if (detail.approval) {
    steps.push({
      id: "approval",
      label: `${detail.approval.role.replaceAll("_", " ")} Approval`,
      status: approved ? "done" : "active",
      tone: approvalStatus === "REJECTED" ? "danger" : approvalStatus === "PENDING" ? "warning" : undefined,
      meta: approved ? `Approved${detail.approval.approver_name ? ` by ${detail.approval.approver_name}` : ""}` : approvalStatus,
    })
  }

  steps.push({ id: "reservation", label: "Reservation Created", status: approved ? "done" : "pending", meta: detail.plan?.reservation_number })

  if (isStores) {
    steps.push({ id: "stock", label: "Stock Available (Stores)", status: approved ? "done" : "pending" })
  } else {
    steps.push({ id: "stockcheck", label: "Stock Check — Shortfall", status: approved ? "done" : "pending" })
    steps.push({ id: "mrp", label: "MRP → PR Generated", status: detail.pr_id ? "done" : approved ? "active" : "pending", meta: detail.pr_number ?? undefined })
    steps.push({ id: "po", label: "PO Created", status: detail.po_id ? "done" : detail.pr_id ? "active" : "pending", meta: detail.po_number ?? undefined })
    steps.push({ id: "gr", label: "Goods Receipt", status: fulfilled ? "done" : detail.po_id ? "active" : "pending" })
  }

  steps.push({ id: "gi", label: "Goods Issue", status: fulfilled ? "done" : approved ? "active" : "pending" })

  const consumptionLabel = detail.stage === "RELEASED" ? "Released (No Longer Required)" : detail.stage === "TRANSFERRED" ? "Transferred (Redeployed)" : "Consumption Confirmed"
  const consumptionStatus = detail.stage === "CONSUMED" || detail.stage === "RELEASED" || detail.stage === "TRANSFERRED" ? "done" : fulfilled ? "active" : "pending"
  steps.push({
    id: "consumption",
    label: consumptionLabel,
    status: consumptionStatus,
    tone: consumptionStatus === "active" && overdue ? "danger" : consumptionStatus === "active" && dueSoon ? "warning" : undefined,
  })

  steps.push({ id: "closed", label: "Closed", status: terminal ? "done" : "pending" })

  return steps
}

function LifecycleRow({ record }: { record: UtilizationRecord }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]">
      <div className="min-w-0">
        <Link href={`/utilization/${record.id}`} className="font-medium text-primary hover:underline">
          {record.tracking_id}
        </Link>
        <span className="ml-2 text-muted-foreground">{record.requester_name} · {record.fulfilment_leg === "STORES" ? "Stores leg" : "Procurement leg"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground">Qty {formatQty(record.qty_requested)}</span>
        <StatusBadge tone={STAGE_TONE[record.stage]}>{STAGE_LABELS[record.stage]}</StatusBadge>
      </div>
    </div>
  )
}

export function UtilizationDetailView({ id }: { id: number }) {
  const [detail, setDetail] = useState<UtilizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<"confirm" | "replan" | "release" | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [actualDate, setActualDate] = useState(todayIso())
  const [comment, setComment] = useState("")
  const [newDate, setNewDate] = useState("")
  const [reason, setReason] = useState(REPLAN_REASONS[0])
  const [releaseReason, setReleaseReason] = useState("No longer required")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getUtilizationDetail(id)
      setDetail(result)
      setNewDate(result.planned_consumption_date)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load this utilization record.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const result = await confirmConsumed(id, actualDate, comment || undefined)
      setDetail(result)
      setActiveAction(null)
      toast.success(`${result.tracking_id} confirmed as consumed.`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to confirm consumption.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReplan() {
    setSubmitting(true)
    try {
      const result = await replanUtilization(id, newDate, reason)
      setDetail(result)
      setActiveAction(null)
      toast.warning(`${result.tracking_id} re-planned to ${newDate}.`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to re-plan.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRelease() {
    setSubmitting(true)
    try {
      const result = await releaseUtilization(id, releaseReason)
      setDetail(result)
      setActiveAction(null)
      toast.success(`${result.tracking_id} released for redeployment.`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to release.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (error || !detail) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error ?? "Not found."}</div>
  }

  const isTerminal = ["CONSUMED", "RELEASED", "TRANSFERRED", "CLOSED"].includes(detail.stage)
  const canAct = !isTerminal && detail.qty_fulfilled > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{detail.tracking_id}</h1>
            <StatusBadge tone={STAGE_TONE[detail.stage]}>{STAGE_LABELS[detail.stage]}</StatusBadge>
            <StatusBadge tone={AGING_TONE[detail.aging_severity]}>{detail.aging_severity}</StatusBadge>
            {detail.risk_level && <StatusBadge tone={RISK_TONE[detail.risk_level]}>Risk: {detail.risk_level}</StatusBadge>}
            {detail.shared_allocation && <StatusBadge tone="default">Shared Allocation</StatusBadge>}
            {detail.historical && <StatusBadge tone="default">Historical / No Original Consumption Plan</StatusBadge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.material_description} ({detail.material_code}) · {detail.plant} · {detail.department} · Requester: {detail.requester_name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <ApprovalStepper steps={buildLifecycleSteps(detail)} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium text-foreground">Warehouse vs. actual utilization</div>
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex items-center gap-2">
              {detail.qty_fulfilled > 0 ? <Check className="size-4 text-success" /> : <Clock className="size-4 text-muted-foreground" />}
              <span className={detail.qty_fulfilled > 0 ? "text-foreground" : "text-muted-foreground"}>
                Goods Issued{detail.qty_fulfilled > 0 ? ` — Qty ${formatQty(detail.qty_fulfilled)}` : " — not yet"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {detail.stage === "CONSUMED" ? (
                <Check className="size-4 text-success" />
              ) : detail.stage === "RELEASED" || detail.stage === "TRANSFERRED" ? (
                <XCircle className="size-4 text-muted-foreground" />
              ) : (
                <AlertTriangle className={`size-4 ${detail.qty_fulfilled > 0 ? "text-warning" : "text-muted-foreground"}`} />
              )}
              <span className={detail.stage === "CONSUMED" ? "text-foreground" : "text-muted-foreground"}>
                Actual Utilization —{" "}
                {detail.stage === "CONSUMED"
                  ? `Confirmed ${detail.actual_consumption_date ?? ""}`
                  : detail.stage === "RELEASED"
                    ? "Released, not consumed"
                    : detail.stage === "TRANSFERRED"
                      ? "Transferred, not consumed here"
                      : "Not Confirmed"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Goods Issue only proves the material left the store — Initiative 13 keeps tracking until the
            requester confirms it was actually used.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-medium text-foreground">Lifecycle trace</div>
          <div className="flex flex-col gap-2">
            {detail.events.map((event) => (
              <div key={event.id} className="flex gap-3 border-b border-dashed border-border pb-2 last:border-0 last:pb-0">
                <div className="w-36 shrink-0 text-[11px] text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="min-w-0 flex-1 text-[13px]">
                  <span className="font-medium text-foreground">{event.stage.replaceAll("_", " ")}</span>
                  {event.quantity != null && <span className="text-muted-foreground"> · Qty {formatQty(event.quantity)}</span>}
                  {event.actor_name && <span className="text-muted-foreground"> · {event.actor_name}</span>}
                  {event.note && <div className="text-muted-foreground">{event.note}</div>}
                </div>
              </div>
            ))}
            {detail.events.length === 0 && <p className="text-sm text-muted-foreground">No trace events yet.</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-sm font-medium text-foreground">Quantities &amp; chain</div>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted-foreground">Requested</dt><dd className="text-foreground">{formatQty(detail.qty_requested)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Fulfilled</dt><dd className="text-foreground">{formatQty(detail.qty_fulfilled)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Consumed</dt><dd className="text-foreground">{formatQty(detail.qty_consumed)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">RR</dt><dd className="text-foreground">{detail.rr_number ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Reservation</dt><dd className="text-foreground">{detail.plan?.reservation_number ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">PR</dt><dd className="text-foreground">{detail.pr_number ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">PO</dt><dd className="text-foreground">{detail.po_number ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Planned consumption</dt><dd className="text-foreground">{detail.planned_consumption_date}</dd></div>
              {detail.replan_count > 0 && (
                <div className="flex justify-between"><dt className="text-muted-foreground">Re-plans</dt><dd className="text-foreground">{detail.replan_count} (was {detail.previous_planned_date})</dd></div>
              )}
            </dl>
          </div>

          {detail.plan && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium text-foreground">Consumption plan</div>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="text-foreground">{detail.plan.reservation_type === "JOB_CARD" ? "Job-card-linked" : "Straight reservation"}</dd></div>
                {detail.plan.job_card_number && <div className="flex justify-between"><dt className="text-muted-foreground">Job card</dt><dd className="text-foreground">{detail.plan.job_card_number}</dd></div>}
                {detail.plan.equipment && <div className="flex justify-between"><dt className="text-muted-foreground">Equipment</dt><dd className="text-foreground">{detail.plan.equipment}</dd></div>}
                {detail.plan.project && <div className="flex justify-between"><dt className="text-muted-foreground">Project</dt><dd className="text-foreground">{detail.plan.project}</dd></div>}
                <div><dt className="text-muted-foreground">Purpose</dt><dd className="mt-0.5 text-foreground">{detail.plan.purpose}</dd></div>
              </dl>
            </div>
          )}

          {detail.risk_drivers.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium text-foreground">NM/SM risk drivers</div>
              <ul className="list-inside list-disc space-y-1 text-[13px] text-muted-foreground">
                {detail.risk_drivers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}

          {detail.escalation && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <AlertTriangle className="size-4 text-warning" /> Escalation
              </div>
              <p className="text-[13px] text-muted-foreground">
                Currently with <span className="text-foreground">{detail.escalation.owner_name ?? detail.escalation.level}</span> ({detail.escalation.level}),
                waiting since {detail.escalation.waiting_since}, {detail.escalation.reminder_count} reminder(s) sent.
              </p>
            </div>
          )}
        </div>
      </div>

      {(detail.sibling_legs.length > 0 || detail.consolidated_with.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {detail.sibling_legs.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium text-foreground">Other fulfilment leg(s) for this reservation</div>
              <div className="flex flex-col gap-1.5">
                {detail.sibling_legs.map((s) => <LifecycleRow key={s.id} record={s} />)}
              </div>
            </div>
          )}
          {detail.consolidated_with.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium text-foreground">
                Consolidated with ({detail.pr_number}) — FIFO allocation by requirement date
              </div>
              <div className="flex flex-col gap-1.5">
                {detail.consolidated_with.map((s) => <LifecycleRow key={s.id} record={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {canAct && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium text-foreground">Requester actions</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10" onClick={() => setActiveAction(activeAction === "confirm" ? null : "confirm")}>
              <Check className="size-3.5" /> Confirm Consumed
            </Button>
            <Button size="sm" variant="outline" onClick={() => setActiveAction(activeAction === "replan" ? null : "replan")}>
              <RotateCcw className="size-3.5" /> Delayed / Re-plan
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setActiveAction(activeAction === "release" ? null : "release")}>
              <XCircle className="size-3.5" /> No Longer Required
            </Button>
          </div>

          {activeAction === "confirm" && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Actual consumption date</label>
                <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className="w-44" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Comment (optional)</label>
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note" />
              </div>
              <Button size="sm" disabled={submitting} onClick={handleConfirm}>Submit</Button>
            </div>
          )}

          {activeAction === "replan" && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">New planned consumption date</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-44" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Reason (required)</label>
                <Select value={reason} onValueChange={(v) => setReason((v as string) ?? REPLAN_REASONS[0])}>
                  <SelectTrigger className="h-9 w-full"><SelectValue>{(v: string) => v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {REPLAN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={submitting} onClick={handleReplan}>Submit</Button>
            </div>
          )}

          {activeAction === "release" && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Reason</label>
                <Input value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} />
              </div>
              <Button size="sm" variant="destructive" disabled={submitting} onClick={handleRelease}>Submit</Button>
            </div>
          )}
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" /> AI recommends, humans approve and execute — no SAP action is taken automatically.
          </p>
        </div>
      )}

      {(detail.release_reason || detail.replan_reason) && (
        <p className="text-xs text-muted-foreground">
          {detail.stage === "RELEASED" && detail.release_reason && `Released: ${detail.release_reason}. `}
          {detail.replan_reason && `Last re-plan reason: ${detail.replan_reason}.`}
        </p>
      )}
    </div>
  )
}
