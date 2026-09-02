"use client"

import { useState } from "react"
import { CircleCheck, ClipboardCheck, TriangleAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  isAwaitingAttestation,
  repairAgingTone,
  type RefurbishableItem,
  type StripOption,
} from "@/lib/refurbishables-data"
import { cn } from "@/lib/utils"

const STRIP_OPTIONS: { value: StripOption; hint: string }[] = [
  { value: "Internal team", hint: "VZI workshop strips and assesses on site" },
  { value: "Vendor assessment", hint: "Item goes to the vendor for strip/assess" },
]

export interface AttestationInput {
  conditionNotes: string
  stripBy: StripOption
}

function AttestationForm({
  item,
  onCancel,
  onSubmit,
}: {
  item: RefurbishableItem
  onCancel: () => void
  onSubmit: (input: AttestationInput) => void
}) {
  const [conditionNotes, setConditionNotes] = useState("")
  const [stripBy, setStripBy] = useState<StripOption>("Internal team")
  const [confirmed, setConfirmed] = useState(false)
  const ready = conditionNotes.trim().length > 0 && confirmed

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <div>
        <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Removal reason (from removal record)
        </div>
        <div className="mt-0.5 text-[13px] text-foreground">
          {item.removalReason}
        </div>
      </div>

      <div>
        <label
          htmlFor={`condition-${item.id}`}
          className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
        >
          Condition assessment
        </label>
        <textarea
          id={`condition-${item.id}`}
          value={conditionNotes}
          onChange={(e) => setConditionNotes(e.target.value)}
          rows={3}
          placeholder="What was found on inspection — wear, damage, salvageable components..."
          className="mt-1 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      <div>
        <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Strip / assess by
        </div>
        <div className="mt-1 flex flex-col gap-1.5 sm:flex-row">
          {STRIP_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={stripBy === option.value ? "default" : "outline"}
              aria-pressed={stripBy === option.value}
              onClick={() => setStripBy(option.value)}
            >
              {option.value}
            </Button>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {STRIP_OPTIONS.find((option) => option.value === stripBy)?.hint}
        </div>
      </div>

      <label className="flex items-start gap-2 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        I confirm this condition declaration is accurate and that{" "}
        {item.materialCode} ({item.serialNo}) may enter the repair loop.
      </label>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={!ready}
          onClick={() => onSubmit({ conditionNotes: conditionNotes.trim(), stripBy })}
        >
          <ClipboardCheck className="size-3.5" />
          Submit attestation
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function AttestationQueue({
  items,
  onAttest,
}: {
  items: RefurbishableItem[]
  onAttest: (id: string, input: AttestationInput) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const queue = items.filter(isAwaitingAttestation)

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border p-8 text-center">
        <CircleCheck className="size-5 text-success" />
        <div className="text-sm font-medium text-foreground">
          Nothing waiting on attestation
        </div>
        <div className="text-xs text-muted-foreground">
          Every removal on the register carries a completed condition
          declaration.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {queue.map((item) => {
        const tone = repairAgingTone(item)
        const isOpen = openId === item.id
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border p-3",
              tone === "danger"
                ? "border-destructive/40 bg-destructive/5"
                : "border-warning/40 bg-warning/5"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <TriangleAlert
                    className={cn(
                      "size-3.5 shrink-0",
                      tone === "danger" ? "text-destructive" : "text-warning"
                    )}
                  />
                  <span className="font-mono text-[13px] font-medium text-foreground">
                    {item.materialCode}
                  </span>
                  <StatusBadge tone={tone === "danger" ? "danger" : "warning"}>
                    {`${item.daysOut} days waiting`}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[13px] text-foreground">
                  {item.description}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.plant} · {item.serialNo} · removed {item.removedOn} by{" "}
                  {item.removedBy} ({item.removedByRole})
                </div>
              </div>
              {!isOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(item.id)}
                >
                  <ClipboardCheck className="size-3.5" />
                  Complete attestation
                </Button>
              )}
            </div>

            {isOpen && (
              <AttestationForm
                item={item}
                onCancel={() => setOpenId(null)}
                onSubmit={(input) => {
                  onAttest(item.id, input)
                  setOpenId(null)
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
