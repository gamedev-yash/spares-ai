"use client"

import type { ReactNode } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export const ALL_FILTER = "all"

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  width = "sm:w-44",
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  allLabel: string
  width?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL_FILTER)}>
      <SelectTrigger className={cn("h-9 w-full", width)}>
        <SelectValue placeholder={allLabel}>
          {(v: string) => (v === ALL_FILTER ? allLabel : v)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FILTER}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
