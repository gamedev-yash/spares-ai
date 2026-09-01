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
import { UtilisationTraceDialog } from "@/components/utilisation/utilisation-trace-dialog"
import { PLANT_ABBR, type ChainStatus, type UtilisationLedgerRow } from "@/lib/utilisation-data"
import { cn, formatZAR } from "@/lib/utils"

const CHAIN_TONE: Record<ChainStatus, "success" | "default" | "danger" | "warning"> = {
  "Fully linked": "success",
  "Shared allocation": "default",
  Reconstructed: "default",
  "Broken link": "danger",
  "Awaiting reconciliation": "danger",
}

function ChainBadge({ row }: { row: UtilisationLedgerRow }) {
  const note = row.reconciliationNote ?? row.allocationNote
  return (
    <span title={note} className={note ? "cursor-help" : undefined}>
      <StatusBadge tone={CHAIN_TONE[row.chainStatus]} className="normal-case">
        {row.chainStatus}
      </StatusBadge>
    </span>
  )
}

function ExceptionBadge({ row }: { row: UtilisationLedgerRow }) {
  return (
    <StatusBadge tone={row.exceptionTone} className="normal-case">
      {row.exceptionLabel}
    </StatusBadge>
  )
}

type TabKey = "all" | "needs-attention" | "broken" | "awaiting-confirmation"

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-attention", label: "Needs attention" },
  { key: "broken", label: "Broken / Reconcile" },
  { key: "awaiting-confirmation", label: "Awaiting confirmation" },
]

function needsAttention(r: UtilisationLedgerRow): boolean {
  if (r.utilisationStatus === "Not yet due") return false
  if (r.utilisationStatus === "Confirmed consumed" && r.agingDays === 0) return false
  return true
}

function filterRows(rows: UtilisationLedgerRow[], tab: TabKey): UtilisationLedgerRow[] {
  if (tab === "needs-attention") return rows.filter(needsAttention)
  if (tab === "broken")
    return rows.filter(
      (r) => r.chainStatus === "Broken link" || r.chainStatus === "Awaiting reconciliation"
    )
  if (tab === "awaiting-confirmation")
    return rows.filter((r) => r.utilisationStatus === "Awaiting confirmation")
  return rows
}

function LedgerRows({ rows }: { rows: UtilisationLedgerRow[] }) {
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
            <TableHead>Requester / accountability</TableHead>
            <TableHead>Reservation</TableHead>
            <TableHead>PR</TableHead>
            <TableHead>PO</TableHead>
            <TableHead>Planned consumption</TableHead>
            <TableHead>Goods receipt</TableHead>
            <TableHead>Goods issue</TableHead>
            <TableHead>Utilisation</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead>Exception / aging</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[200px]">
                <div className="truncate font-medium text-foreground">
                  {row.materialDescription}
                </div>
                <div className="text-[11px] text-muted-foreground">{row.materialCode}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.plant}
                {PLANT_ABBR[row.plant] !== row.plant && (
                  <span className="ml-1 text-[10px] text-muted-foreground/70">
                    ({PLANT_ABBR[row.plant]})
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-[180px]">
                <div className="truncate text-foreground">{row.requester}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {row.department}
                  {row.costCentre ? ` · ${row.costCentre}` : ""}
                  {row.workOrder ? ` · ${row.workOrder}` : ""}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.reservationNumber}/{row.reservationLine}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.prNumber ?? "—"}
                {row.prAllocationType === "Shared allocation" && (
                  <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Shared
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.poNumber ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.plannedConsumptionDate ?? "Not captured"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.goodsReceiptDate ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.goodsIssueDate ?? "Not issued"}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.utilisationStatus}</TableCell>
              <TableCell>
                <ChainBadge row={row} />
              </TableCell>
              <TableCell>
                <ExceptionBadge row={row} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {formatZAR(row.valueZar)}
              </TableCell>
              <TableCell>
                <UtilisationTraceDialog row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-2 text-xs text-muted-foreground">
        Showing {rows.length} lines · value {formatZAR(rows.reduce((s, r) => s + r.valueZar, 0))}
      </div>
    </>
  )
}

export function UtilisationLedger({ rows }: { rows: UtilisationLedgerRow[] }) {
  const [tab, setTab] = useState<TabKey>("all")
  const counts = useMemo(
    () =>
      TABS.reduce<Record<TabKey, number>>(
        (acc, t) => {
          acc[t.key] = filterRows(rows, t.key).length
          return acc
        },
        { all: 0, "needs-attention": 0, broken: 0, "awaiting-confirmation": 0 }
      ),
    [rows]
  )

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab((value ?? "all") as TabKey)}
      className="min-w-0"
    >
      <TabsList
        variant="line"
        className={cn(
          "h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent px-0 py-0"
        )}
      >
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="px-0.5 py-2.5 text-sm">
            {t.label} ({counts[t.key]})
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="grid min-w-0">
        {TABS.map((t) => (
          <TabsContent
            key={t.key}
            value={t.key}
            className="col-start-1 row-start-1 min-w-0 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
          >
            <LedgerRows rows={filterRows(rows, t.key)} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
