"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { OptionCard } from "@/components/chat/option-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { DecisionOption } from "@/lib/types"

export function DecisionControls({
  options,
  resolvedId,
  onDecide,
  accentId,
  requireReasonFor = [],
}: {
  options: DecisionOption[]
  resolvedId?: string
  onDecide: (optionId: string, reason?: string) => void
  accentId?: string
  requireReasonFor?: string[]
}) {
  const isResolved = resolvedId !== undefined
  const [pendingId, setPendingId] = useState<string | undefined>(undefined)
  const [reason, setReason] = useState("")
  const selectedId = isResolved ? resolvedId : pendingId
  const needsReason = pendingId !== undefined && requireReasonFor.includes(pendingId)

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" className="flex flex-col gap-1.5">
        {options.map((option) => {
          const isAccent = option.id === accentId
          const isChosen = option.id === resolvedId
          return (
            <OptionCard
              key={option.id}
              icon={option.icon}
              label={option.label}
              description={option.description}
              showRadio={false}
              tone={isAccent ? "success" : "default"}
              selected={option.id === selectedId}
              disabled={isResolved && !isChosen}
              onSelect={isResolved ? undefined : () => setPendingId(option.id)}
            />
          )
        })}
      </div>
      {!isResolved && needsReason && (
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
        />
      )}
      {!isResolved && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            disabled={!pendingId || (needsReason && !reason.trim())}
            onClick={() =>
              pendingId && onDecide(pendingId, reason.trim() || undefined)
            }
          >
            <Check className="size-3" />
            Confirm
          </Button>
        </div>
      )}
    </div>
  )
}
