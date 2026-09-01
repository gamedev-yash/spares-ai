"use client"

import { useMemo, useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Criticality, LedgerRow } from "@/lib/utilisation-data"
import { cn, formatZAR } from "@/lib/utils"

const CRITICALITY_CLASSES: Record<Criticality, string> = {
  CRITICAL: "bg-destructive/10 text-destructive",
  IMPACT: "bg-warning/15 text-warning",
  INSURANCE: "bg-accent text-accent-foreground",
  NORMAL: "bg-success/15 text-success",
  OBSOLETE: "bg-muted text-muted-foreground",
}

function CriticalityBadge({ tier }: { tier: Criticality }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap",
        CRITICALITY_CLASSES[tier]
      )}
    >
      {tier}
    </span>
  )
}

function ChainStatusBadge({ row }: { row: LedgerRow }) {
  const isBroken = row.chainStatus === "Broken link"
  return (
    <span title={row.brokenReason} className={row.brokenReason ? "cursor-help" : undefined}>
      <StatusBadge tone={isBroken ? "danger" : "success"} className="normal-case">
        {row.chainStatus}
      </StatusBadge>
    </span>
  )
}

type TabKey = "all" | "not-issued" | "broken"

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not-issued", label: "Not issued" },
  { key: "broken", label: "Broken links" },
]

function filterRows(rows: LedgerRow[], tab: TabKey): LedgerRow[] {
  if (tab === "not-issued") return rows.filter((r) => r.issueDate === null)
  if (tab === "broken") return rows.filter((r) => r.chainStatus === "Broken link")
  return rows
}

function LedgerRows({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No lines match this view.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Requestor</TableHead>
            <TableHead>Reservation</TableHead>
            <TableHead>PO</TableHead>
            <TableHead>GR date</TableHead>
            <TableHead>Issue date</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead>Criticality</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[220px]">
                <div className="truncate font-medium text-foreground">
                  {row.description}
                </div>
                <div className="text-[11px] text-muted-foreground">{row.materialId}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.plant}</TableCell>
              <TableCell>
                <div className="text-foreground">{row.requestor}</div>
                <div className="text-[11px] text-muted-foreground">{row.costCentre}</div>
              </TableCell>
              <TableCell
                className={
                  row.reservationRef === "—"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {row.reservationRef}
              </TableCell>
              <TableCell
                className={row.poRef === "—" ? "text-destructive" : "text-muted-foreground"}
              >
                {row.poRef}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.grDate}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.issueDate ?? `Not issued (${row.daysSinceGr}d)`}
              </TableCell>
              <TableCell>
                <ChainStatusBadge row={row} />
              </TableCell>
              <TableCell>
                <CriticalityBadge tier={row.criticality} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {formatZAR(row.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-2 text-xs text-muted-foreground">
        Showing {rows.length} lines · value {formatZAR(rows.reduce((s, r) => s + r.value, 0))}
      </div>
    </>
  )
}

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  const [tab, setTab] = useState<TabKey>("all")
  const counts = useMemo(
    () =>
      TABS.reduce<Record<TabKey, number>>(
        (acc, t) => {
          acc[t.key] = filterRows(rows, t.key).length
          return acc
        },
        { all: 0, "not-issued": 0, broken: 0 }
      ),
    [rows]
  )

  return (
    <Tabs value={tab} onValueChange={(value) => setTab((value ?? "all") as TabKey)}>
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent px-0 py-0"
      >
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="px-0.5 py-2.5 text-sm">
            {t.label} ({counts[t.key]})
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="grid">
        {TABS.map((t) => (
          <TabsContent
            key={t.key}
            value={t.key}
            className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
          >
            <LedgerRows rows={filterRows(rows, t.key)} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
