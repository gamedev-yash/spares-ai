"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bell, MessageCircle, X } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
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
import { BU_PLANTS, ROOT_CAUSE_CATEGORIES } from "@/lib/constants"
import type { PrPoSituation, RootCauseCategory, Urgency } from "@/lib/types"
import { cn, daysStuckTone, formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"
const URGENCIES: Urgency[] = ["Normal", "High", "Critical"]

const URGENCY_TONE: Record<Urgency, "default" | "warning" | "danger"> = {
  Normal: "default",
  High: "warning",
  Critical: "danger",
}

const DAYS_STUCK_CLASSES: Record<ReturnType<typeof daysStuckTone>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
}

function remind(item: PrPoSituation) {
  toast.success(`Reminder sent to ${item.stuckWithPerson}`, {
    description: `${item.prPoNumber} — ${item.currentStageName}, stuck ${item.daysStuck} day${item.daysStuck === 1 ? "" : "s"}.`,
  })
}

export function DrilldownTable({
  items,
  stageFilter,
  onClearStageFilter,
}: {
  items: PrPoSituation[]
  stageFilter: { no: number; name: string } | null
  onClearStageFilter: () => void
}) {
  const [buPlant, setBuPlant] = useState<string>(ALL_FILTER)
  const [rootCause, setRootCause] = useState<RootCauseCategory | typeof ALL_FILTER>(
    ALL_FILTER
  )
  const [urgency, setUrgency] = useState<Urgency | typeof ALL_FILTER>(ALL_FILTER)

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (stageFilter && item.currentStageNo !== stageFilter.no) return false
      if (buPlant !== ALL_FILTER && item.buPlant !== buPlant) return false
      if (rootCause !== ALL_FILTER && item.rootCauseCategory !== rootCause) return false
      if (urgency !== ALL_FILTER && item.urgency !== urgency) return false
      return true
    })
  }, [items, stageFilter, buPlant, rootCause, urgency])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={buPlant}
          onValueChange={(value) => setBuPlant(value ?? ALL_FILTER)}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="BU / Plant">
              {(value: string) => (value === ALL_FILTER ? "All BU / Plant" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All BU / Plant</SelectItem>
            {BU_PLANTS.map((plant) => (
              <SelectItem key={plant} value={plant}>
                {plant}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={rootCause}
          onValueChange={(value) =>
            setRootCause(value as RootCauseCategory | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Root cause">
              {(value: string) => (value === ALL_FILTER ? "All root causes" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All root causes</SelectItem>
            {ROOT_CAUSE_CATEGORIES.map((cause) => (
              <SelectItem key={cause} value={cause}>
                {cause}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={urgency}
          onValueChange={(value) => setUrgency(value as Urgency | typeof ALL_FILTER)}
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

        {stageFilter && (
          <button
            type="button"
            onClick={onClearStageFilter}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-accent px-3 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/70"
          >
            Stage {stageFilter.no}: {stageFilter.name}
            <X className="size-3.5" />
          </button>
        )}
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
              <TableHead>BU / Plant</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Current Stage</TableHead>
              <TableHead>Stuck With</TableHead>
              <TableHead className="text-right">Days Stuck</TableHead>
              <TableHead>Root Cause</TableHead>
              <TableHead>Urgency</TableHead>
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
                  {item.buPlant}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-foreground">
                  {item.materialDescription}
                </TableCell>
                <TableCell>
                  <div className="text-foreground">Stage {item.currentStageNo}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.currentStageName}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{item.stuckWithPerson}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.stuckWithRole}
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    DAYS_STUCK_CLASSES[daysStuckTone(item.daysStuck)]
                  )}
                >
                  {item.daysStuck}d
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.rootCauseCategory}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={URGENCY_TONE[item.urgency]}>
                    {item.urgency}
                  </StatusBadge>
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
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => remind(item)}
                    >
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
