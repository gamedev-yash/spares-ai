"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { StageIndicator } from "@/components/refurbishables/stage-indicator"
import { StatusBadge } from "@/components/shared/status-badge"
import { Input } from "@/components/ui/input"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AGING_AMBER_DAYS,
  AGING_RED_DAYS,
  isAwaitingAttestation,
  isInRepairLoop,
  isOverdue,
  repairAgingTone,
  type RefurbishableItem,
} from "@/lib/refurbishables-data"
import type { VziUnit } from "@/lib/types"
import { cn, formatZAR, type SeverityTone } from "@/lib/utils"

const ALL_FILTER = "all"
const PLANTS: VziUnit[] = ["Gamsberg", "BMM"]

const REGISTER_TABS = [
  { value: "all", label: "All", match: () => true },
  {
    value: "in-repair",
    label: "In repair",
    match: (item: RefurbishableItem) => item.stage === "In repair",
  },
  {
    value: "awaiting",
    label: "Awaiting attestation",
    match: isAwaitingAttestation,
  },
  { value: "overdue", label: "Overdue", match: isOverdue },
] as const

const DAYS_CLASS: Record<SeverityTone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
}

function AgingFlag({ item }: { item: RefurbishableItem }) {
  if (!isInRepairLoop(item)) {
    return <StatusBadge tone="success">Closed</StatusBadge>
  }
  const tone = repairAgingTone(item)
  if (tone === "danger") {
    return <StatusBadge tone="danger">{`> ${AGING_RED_DAYS} days`}</StatusBadge>
  }
  if (tone === "warning") {
    return <StatusBadge tone="warning">{`> ${AGING_AMBER_DAYS} days`}</StatusBadge>
  }
  return <StatusBadge tone="default">On track</StatusBadge>
}

function RegisterTable({ items }: { items: RefurbishableItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No refurbishable items match these filters.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>80-series material</TableHead>
          <TableHead>Plant</TableHead>
          <TableHead>Repair vendor</TableHead>
          <TableHead>Repair PO</TableHead>
          <TableHead>Lifecycle stage</TableHead>
          <TableHead className="text-right">Days out</TableHead>
          <TableHead className="text-right">Value (ZAR)</TableHead>
          <TableHead>Aging flag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const blocked = isAwaitingAttestation(item)
          const tone = repairAgingTone(item)
          return (
            <TableRow
              key={item.id}
              className={cn(blocked && "bg-warning/5")}
              title={
                item.attested
                  ? `Attested by ${item.removedBy} on ${item.attestedOn} — strip by ${item.stripBy}. Condition: ${item.conditionNotes}`
                  : `Removed ${item.removedOn} by ${item.removedBy} — ${item.removalReason}. Condition declaration outstanding.`
              }
            >
              <TableCell>
                <div className="font-mono text-[13px] font-medium text-foreground">
                  {item.materialCode}
                </div>
                <div className="max-w-[220px] truncate text-[11px] text-muted-foreground">
                  {item.description} · {item.serialNo}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.plant}
              </TableCell>
              <TableCell className="max-w-[150px] truncate text-muted-foreground">
                {item.repairVendor}
              </TableCell>
              <TableCell className="font-mono text-[13px] text-muted-foreground">
                {item.repairPoRef ?? "—"}
              </TableCell>
              <TableCell>
                <StageIndicator
                  stage={item.stage}
                  tone={tone}
                  blocked={blocked}
                />
              </TableCell>
              <TableCell className="text-right">
                <div
                  className={cn(
                    "font-medium tabular-nums",
                    isInRepairLoop(item)
                      ? DAYS_CLASS[tone]
                      : "text-muted-foreground"
                  )}
                >
                  {item.daysOut}d
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {item.closedOn
                    ? `closed ${item.closedOn}`
                    : `out ${item.removedOn}`}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {formatZAR(item.valueZar)}
              </TableCell>
              <TableCell>
                <AgingFlag item={item} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function RepairRegister({ items }: { items: RefurbishableItem[] }) {
  const [query, setQuery] = useState("")
  const [plant, setPlant] = useState<VziUnit | typeof ALL_FILTER>(ALL_FILTER)

  // Search + plant narrow the population first; the tabs then cut that set by
  // lifecycle state, so the tab counts always match what a tab will show.
  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (plant !== ALL_FILTER && item.plant !== plant) return false
      if (!needle) return true
      return (
        item.materialCode.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.serialNo.toLowerCase().includes(needle) ||
        item.repairVendor.toLowerCase().includes(needle) ||
        (item.repairPoRef ?? "").toLowerCase().includes(needle)
      )
    })
  }, [items, plant, query])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by 80-series code, description, serial, vendor or repair PO..."
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={plant}
          onValueChange={(value) =>
            setPlant((value ?? ALL_FILTER) as VziUnit | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Plant">
              {(value: string) => (value === ALL_FILTER ? "All plants" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plants</SelectItem>
            {PLANTS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent px-0 py-0"
        >
          {REGISTER_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-0.5 py-2.5 text-sm"
            >
              {tab.label}
              <span className="text-xs text-muted-foreground">
                {scoped.filter(tab.match).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Panels share one grid cell so a panel stuck mid-exit-transition
            overlaps instead of pushing the card to double height. */}
        <div className="grid">
          {REGISTER_TABS.map((tab) => {
            const rows = scoped.filter(tab.match)
            return (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="col-start-1 row-start-1 pt-3 data-ending-style:invisible data-ending-style:pointer-events-none"
              >
                <RegisterTable items={rows} />
                <div className="mt-3 text-xs text-muted-foreground">
                  Showing {rows.length} of {items.length} serialised items ·
                  value in view{" "}
                  {formatZAR(rows.reduce((sum, item) => sum + item.valueZar, 0))}
                </div>
              </TabsContent>
            )
          })}
        </div>
      </Tabs>
    </div>
  )
}
