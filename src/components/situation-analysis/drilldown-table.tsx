"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bell, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  FishboneCategory,
  SituationDrillDownItem,
  Urgency,
  VziUnit,
} from "@/lib/types"
import { formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"
const UNITS: VziUnit[] = ["Gamsberg", "BMM"]
const TYPES: ("Material" | "Service")[] = ["Material", "Service"]
const URGENCIES: Urgency[] = ["Normal", "High", "Critical"]

function remind(item: SituationDrillDownItem) {
  toast.success(`Reminder sent to ${item.stuckWithPerson}`, {
    description: `${item.prPoNumber} — ${item.rootCauseCategory}, ${item.agingBucket}.`,
  })
}

export function DrilldownTable({
  items,
  rootCauseCategories,
}: {
  items: SituationDrillDownItem[]
  rootCauseCategories: FishboneCategory[]
}) {
  const [unit, setUnit] = useState<VziUnit | typeof ALL_FILTER>(ALL_FILTER)
  const [type, setType] = useState<"Material" | "Service" | typeof ALL_FILTER>(
    ALL_FILTER
  )
  const [rootCause, setRootCause] = useState<
    FishboneCategory | typeof ALL_FILTER
  >(ALL_FILTER)
  const [urgency, setUrgency] = useState<Urgency | typeof ALL_FILTER>(ALL_FILTER)

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (unit !== ALL_FILTER && item.unit !== unit) return false
      if (type !== ALL_FILTER && item.type !== type) return false
      if (rootCause !== ALL_FILTER && item.rootCauseCategory !== rootCause) return false
      if (urgency !== ALL_FILTER && item.urgency !== urgency) return false
      return true
    })
  }, [items, unit, type, rootCause, urgency])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={unit}
          onValueChange={(value) => setUnit((value ?? ALL_FILTER) as VziUnit | typeof ALL_FILTER)}
        >
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue placeholder="Unit">
              {(value: string) => (value === ALL_FILTER ? "All units" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All units</SelectItem>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type}
          onValueChange={(value) =>
            setType((value ?? ALL_FILTER) as "Material" | "Service" | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue placeholder="Type">
              {(value: string) => (value === ALL_FILTER ? "All types" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={rootCause}
          onValueChange={(value) =>
            setRootCause((value ?? ALL_FILTER) as FishboneCategory | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-64">
            <SelectValue placeholder="Root cause">
              {(value: string) => (value === ALL_FILTER ? "All root causes" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All root causes</SelectItem>
            {rootCauseCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={urgency}
          onValueChange={(value) =>
            setUrgency((value ?? ALL_FILTER) as Urgency | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Urgency">
              {(value: string) => (value === ALL_FILTER ? "All urgencies" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All urgencies</SelectItem>
            {URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No open PRs/POs match these filters.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR/PO #</TableHead>
              <TableHead>Unit / Area</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Value (ZAR)</TableHead>
              <TableHead>Aging Bucket</TableHead>
              <TableHead>Root Cause Category</TableHead>
              <TableHead>Primary Cause Detail</TableHead>
              <TableHead>Stuck With</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">
                  {item.prPoNumber}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.unit} — {item.area}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.type}</TableCell>
                <TableCell className="text-muted-foreground">{item.category}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-foreground">
                  {formatZAR(item.valueZar)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.agingBucket}
                </TableCell>
                <TableCell className="max-w-[190px] truncate text-muted-foreground">
                  {item.rootCauseCategory}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">
                  {item.primaryCauseDetail}
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{item.stuckWithPerson}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.stuckWithRole}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {item.sessionId && (
                      <Link
                        href={`/chat/${item.sessionId}`}
                        className={buttonVariants({ variant: "outline", size: "xs" })}
                      >
                        <MessageCircle className="size-3.5" />
                        Chat
                      </Link>
                    )}
                    <Button size="xs" variant="outline" onClick={() => remind(item)}>
                      <Bell className="size-3.5" />
                      Remind
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {items.length} open PRs/POs · total{" "}
        {formatZAR(filtered.reduce((sum, i) => sum + i.valueZar, 0))}
      </div>
    </div>
  )
}
