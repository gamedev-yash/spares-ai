"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AI_ASSISTANT_CONTEXTS } from "@/lib/constants"

export type AIContextId = (typeof AI_ASSISTANT_CONTEXTS)[number]["id"]

/** Lets the user scope the AI Assistant's suggested questions to a
 * module — All Spares, Procurement, or one of the new initiatives — without
 * touching the underlying chat engine or message data. */
export function AIContextSelector({
  value,
  onChange,
}: {
  value: AIContextId
  onChange: (value: AIContextId) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AIContextId)}>
      <SelectTrigger size="sm" className="h-7 text-xs">
        <SelectValue placeholder="Context">
          {(v: string) => AI_ASSISTANT_CONTEXTS.find((c) => c.id === v)?.label ?? v}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {AI_ASSISTANT_CONTEXTS.map((ctx) => (
          <SelectItem key={ctx.id} value={ctx.id}>
            {ctx.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
