"use client"

import { useId, useState } from "react"
import { CalendarClock, CircleCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { USERS } from "@/lib/shared-data/users"
import { cn } from "@/lib/utils"

let trackingCounter = 12 // seed past the OAR-TRK-0001..0011 ledger scenarios

function nextTrackingId(): string {
  trackingCounter += 1
  return `OAR-TRK-${String(trackingCounter).padStart(4, "0")}`
}

function nextReservationNumber(): string {
  return `RES-5003${Math.floor(10 + Math.random() * 89)}`
}

interface FormState {
  plannedConsumptionDate: string
  purpose: string
  project: string
  jobWorkOrder: string
  equipment: string
}

const EMPTY_FORM: FormState = {
  plannedConsumptionDate: "",
  purpose: "",
  project: "",
  jobWorkOrder: "",
  equipment: "",
}

const MANDATORY_FIELDS: (keyof FormState)[] = [
  "plannedConsumptionDate",
  "purpose",
  "jobWorkOrder",
  "equipment",
]

/**
 * The real OAR consumption-plan capture form — rendered inline in an active
 * chat session (via the shared `RRExtensionSlot`) whenever the material on
 * that session is OAR-managed. Purely a UI-only simulation: no
 * SAP write happens here, this is a mockup. On submit it generates a mock
 * Tracking ID and associates it with a mock SAP Reservation Number, both
 * shown back inline plus a toast — nothing is persisted beyond this
 * component's state.
 */
export function OARConsumptionPlanExtension({
  materialId,
  requestType,
}: {
  materialId: string
  requestType: string
}) {
  const formId = useId()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, boolean>>>({})
  const [submission, setSubmission] = useState<{ trackingId: string; reservation: string } | null>(
    null
  )

  // Requester/department pulled from shared master data rather than invented.
  const requester = USERS.find((u) => u.role === "Requester") ?? USERS[0]

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: Partial<Record<keyof FormState, boolean>> = {}
    for (const field of MANDATORY_FIELDS) {
      if (!form[field].trim()) nextErrors[field] = true
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error("Fill in all mandatory fields before submitting the consumption plan.")
      return
    }

    const trackingId = nextTrackingId()
    const reservation = nextReservationNumber()
    setSubmission({ trackingId, reservation })
    toast.success(`Consumption plan captured — Tracking ID ${trackingId}`)
  }

  if (submission) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs">
        <div className="flex items-start gap-2">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              OAR consumption plan captured
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Tracking ID</span>
              <span className="rounded-md border border-border bg-card px-1.5 py-0.5 font-medium text-foreground">
                {submission.trackingId}
              </span>
              <span className="text-muted-foreground">linked to</span>
              <SAPDocumentChip doc={{ type: "RESERVATION", documentNumber: submission.reservation }} />
            </div>
            <p className="mt-1.5 text-muted-foreground">
              Simulated only — no live SAP write occurred. This mock reservation now feeds the
              Utilization Ledger.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-3 text-xs"
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <CalendarClock className="size-4 text-primary" />
        OAR consumption plan — {materialId}
      </div>
      <p className="mb-2.5 text-[11px] text-muted-foreground">
        This material is Order-As-Required. Capture how and when it will be consumed so it can be
        tracked in the Utilization Ledger. Requester and department are drawn from your profile —{" "}
        {requester.name} ({requester.department}). Request type: {requestType}.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field
          id={`${formId}-date`}
          label="Planned consumption date"
          required
          error={errors.plannedConsumptionDate}
        >
          <Input
            id={`${formId}-date`}
            type="date"
            value={form.plannedConsumptionDate}
            onChange={(e) => update("plannedConsumptionDate", e.target.value)}
            aria-invalid={errors.plannedConsumptionDate}
          />
        </Field>

        <Field id={`${formId}-jwo`} label="Job / Work order" required error={errors.jobWorkOrder}>
          <Input
            id={`${formId}-jwo`}
            placeholder="e.g. WO-88213"
            value={form.jobWorkOrder}
            onChange={(e) => update("jobWorkOrder", e.target.value)}
            aria-invalid={errors.jobWorkOrder}
          />
        </Field>

        <Field id={`${formId}-equipment`} label="Equipment" required error={errors.equipment}>
          <Input
            id={`${formId}-equipment`}
            placeholder="e.g. Warman 8/6 AH slurry pump"
            value={form.equipment}
            onChange={(e) => update("equipment", e.target.value)}
            aria-invalid={errors.equipment}
          />
        </Field>

        <Field id={`${formId}-project`} label="Project (optional)">
          <Input
            id={`${formId}-project`}
            placeholder="e.g. MIL-SHUT-2026"
            value={form.project}
            onChange={(e) => update("project", e.target.value)}
          />
        </Field>

        <Field
          id={`${formId}-purpose`}
          label="Purpose"
          required
          error={errors.purpose}
          className="sm:col-span-2"
        >
          <Input
            id={`${formId}-purpose`}
            placeholder="Why is this material being requested?"
            value={form.purpose}
            onChange={(e) => update("purpose", e.target.value)}
            aria-invalid={errors.purpose}
          />
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm">
          Submit consumption plan
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error && <span className="text-[11px] text-destructive">This field is required.</span>}
    </div>
  )
}
