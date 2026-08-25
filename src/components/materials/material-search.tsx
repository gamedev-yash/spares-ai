"use client"

import { Search } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { LifecycleStatus } from "@/lib/types"

export const ALL_FILTER = "all"

export function MaterialSearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categoryOptions,
  lifecycle,
  onLifecycleChange,
}: {
  query: string
  onQueryChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  categoryOptions: string[]
  lifecycle: LifecycleStatus | typeof ALL_FILTER
  onLifecycleChange: (value: LifecycleStatus | typeof ALL_FILTER) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by code, description, manufacturer, or part number..."
          className="h-9 pl-8"
        />
      </div>

      <Select
        value={category}
        onValueChange={(value) => onCategoryChange(value ?? ALL_FILTER)}
      >
        <SelectTrigger className="h-9 w-full sm:w-52">
          <SelectValue placeholder="Category">
            {(value: string) => (value === ALL_FILTER ? "All categories" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All categories</SelectItem>
          {categoryOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={lifecycle}
        onValueChange={(value) => onLifecycleChange(value as LifecycleStatus | typeof ALL_FILTER)}
      >
        <SelectTrigger className="h-9 w-full sm:w-40">
          <SelectValue placeholder="Lifecycle">
            {(value: string) => (value === ALL_FILTER ? "All statuses" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
          <SelectItem value="Active">Active</SelectItem>
          <SelectItem value="EOL">EOL</SelectItem>
          <SelectItem value="Obsolete">Obsolete</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
