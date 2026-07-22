"use client"

import { OptionCard } from "@/components/chat/option-card"
import type { ActionOptionsData } from "@/lib/types"

export function ActionOptions({
  data,
  resolvedId,
  onAction,
}: {
  data: ActionOptionsData
  resolvedId?: string
  onAction?: (actionId: string) => void
}) {
  const isResolved = Boolean(resolvedId)

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {data.actions.map((action) => {
        const isAccent = action.id === data.accentId
        const isChosen = action.id === resolvedId

        return (
          <OptionCard
            key={action.id}
            icon={action.icon}
            label={action.label}
            description={action.description}
            showRadio={false}
            tone={isAccent ? "success" : "default"}
            disabled={isResolved && !isChosen}
            onSelect={isResolved ? undefined : () => onAction?.(action.id)}
          />
        )
      })}
    </div>
  )
}
