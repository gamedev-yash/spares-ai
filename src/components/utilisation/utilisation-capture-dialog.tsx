"use client"

import { useState } from "react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CaptureRequestInput, UtilisationPlant } from "@/lib/utilisation-data"

const PLANTS: UtilisationPlant[] = ["Gamsberg", "Black Mountain"]

const EMPTY_FORM: CaptureRequestInput = {
  materialCode: "",
  materialDescription: "",
  plant: "Gamsberg",
  requester: "",
  department: "",
  costCentre: "",
  purpose: "",
  plannedConsumptionDate: "",
  quantity: 1,
  valueZar: 25000,
}

function isComplete(form: CaptureRequestInput): boolean {
  return Boolean(
    form.materialCode.trim() &&
      form.materialDescription.trim() &&
      form.requester.trim() &&
      form.department.trim() &&
      form.purpose.trim() &&
      form.plannedConsumptionDate
  )
}

export function UtilisationCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (input: CaptureRequestInput) => void
}) {
  const [form, setForm] = useState<CaptureRequestInput>(EMPTY_FORM)

  function update<K extends keyof CaptureRequestInput>(key: K, value: CaptureRequestInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function submit() {
    if (!isComplete(form)) return
    onCapture(form)
    setForm(EMPTY_FORM)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setForm(EMPTY_FORM)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New OAR request — consumption plan</DialogTitle>
          <DialogDescription>
            Mandatory fields enforced at the point of demand, per the Initiative 9
            RR experience this extends.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">
              Material code
            </label>
            <Input
              placeholder="500-XXXXX"
              value={form.materialCode}
              onChange={(e) => update("materialCode", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">
              Material description
            </label>
            <Input
              placeholder="e.g. Conveyor idler roller 150mm"
              value={form.materialDescription}
              onChange={(e) => update("materialDescription", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Plant</label>
            <Select
              value={form.plant}
              onValueChange={(value) => update("plant", (value ?? "Gamsberg") as UtilisationPlant)}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Quantity</label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => update("quantity", Number(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Requester</label>
            <Input
              placeholder="e.g. T. Mokoena"
              value={form.requester}
              onChange={(e) => update("requester", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Department</label>
            <Input
              placeholder="e.g. Mining Maintenance"
              value={form.department}
              onChange={(e) => update("department", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">
              Cost centre / work order
            </label>
            <Input
              placeholder="e.g. CC-4021-MILL"
              value={form.costCentre}
              onChange={(e) => update("costCentre", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">Purpose</label>
            <Input
              placeholder="Why is this needed?"
              value={form.purpose}
              onChange={(e) => update("purpose", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Planned consumption date
            </label>
            <Input
              type="date"
              value={form.plannedConsumptionDate}
              onChange={(e) => update("plannedConsumptionDate", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Estimated value (ZAR)
            </label>
            <Input
              type="number"
              min={0}
              value={form.valueZar}
              onChange={(e) => update("valueZar", Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!isComplete(form)} onClick={submit}>
            Capture consumption plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
