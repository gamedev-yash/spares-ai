"use client"

import { useState } from "react"

import { OptionCard } from "@/components/chat/option-card"
import type { OptionGroupData } from "@/lib/types"

export function OptionGroup({ group }: { group: OptionGroupData }) {
  const [selectedId, setSelectedId] = useState(group.defaultSelectedId)

  return (
    <div role="radiogroup" className="mt-1 flex flex-col gap-1.5">
      {group.options.map((option) => (
        <OptionCard
          key={option.id}
          icon={option.icon}
          label={option.label}
          description={option.description}
          selected={option.id === selectedId}
          onSelect={() => setSelectedId(option.id)}
        />
      ))}
    </div>
  )
}
