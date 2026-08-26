"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Search, TriangleAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import {
  getRepairPlants,
  getRepairRegister,
  type RepairRegister,
  type RepairRegisterRow,
} from "@/lib/api/repair"
import { cn, downloadCsv, formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"

const STATUS_OPTIONS = [
  { value: "IN_FLIGHT", label: "At vendor, on time" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "REORDER_TRIGGERED", label: "At reorder point" },
] as const

function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "warning" | "danger"
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function RepairRegisterTable() {
  const [plant, setPlant] = useState<string>(ALL_FILTER)
  const [status, setStatus] = useState<string>(ALL_FILTER)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [plants, setPlants] = useState<string[]>([])
  const [data, setData] = useState<RepairRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRepairPlants()
      .then(setPlants)
      .catch(() => setPlants([]))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        await getRepairRegister({
          plant: plant === ALL_FILTER ? undefined : plant,
          status:
            status === ALL_FILTER
              ? undefined
              : (status as "OVERDUE" | "IN_FLIGHT" | "REORDER_TRIGGERED"),
          search: debounced || undefined,
        })
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the repair register.")
    } finally {
      setLoading(false)
    }
  }, [plant, status, debounced])

  useEffect(() => {
    load()
  }, [load])

  function exportCsv(rows: RepairRegisterRow[]) {
    downloadCsv(
      "repair-register.csv",
      [
        "Material",
        "Description",
        "Plant",
        "Stock on hand",
        "Reorder point",
        "Qty under repair",
        "Repair document",
        "Vendor",
        "Expected return",
        "Days open",
        "Overdue",
        "Declarations pending",
      ],
      rows.map((r) => [
        r.material_code ?? "",
        r.material_description ?? "",
        r.plant ?? "",
        r.stock_on_hand,
        r.reorder_point ?? "",
        r.quantity_under_repair,
        r.repair_po_number ?? r.repair_pr_number ?? "",
        r.vendor ?? "",
        r.expected_return ?? "",
        r.days_open ?? "",
        r.overdue ? "Yes" : "No",
        r.declarations_pending,
      ])
    )
  }

  const summary = data?.summary

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <KpiTile
            label="Out for repair"
            value={String(summary.open_chain_count)}
            hint={`${summary.total_quantity_under_repair} units at vendors`}
          />
          <KpiTile
            label="Value in flight"
            value={formatZAR(summary.total_value_under_repair)}
            hint="Committed repair spend"
          />
          <KpiTile
            label="Overdue"
            value={String(summary.overdue_count)}
            hint="Past expected return"
            tone={summary.overdue_count > 0 ? "danger" : "default"}
          />
          <KpiTile
            label="At reorder point"
            value={String(summary.duplicate_risk_count)}
            hint="Could be ordered again"
            tone={summary.duplicate_risk_count > 0 ? "warning" : "default"}
          />
          <KpiTile
            label="Avg days open"
            value={summary.average_days_open != null ? String(summary.average_days_open) : "—"}
            hint="Across open chains"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material, vendor, or document"
            className="h-9 pl-8"
          />
        </div>
        <Select value={plant} onValueChange={(v) => setPlant((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Plant">
              {(value: string) => (value === ALL_FILTER ? "All plants" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plants</SelectItem>
            {plants.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Status">
              {(value: string) =>
                value === ALL_FILTER
                  ? "All statuses"
                  : (STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && data.items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="sm:ml-auto"
            onClick={() => exportCsv(data.items)}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing is currently out for repair for these filters.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {data.total} open repair {data.total === 1 ? "chain" : "chains"}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead className="text-right">Stock on hand</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead className="text-right">Under repair</TableHead>
                <TableHead>Repair document</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Expected back</TableHead>
                <TableHead className="text-right">Days open</TableHead>
                <TableHead>Declaration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow
                  key={`${row.material_id}-${row.repair_po_id ?? row.repair_pr_id}`}
                  className={cn(row.duplicate_risk && "bg-warning/5")}
                >
                  <TableCell className="max-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{row.material_code}</span>
                      {row.duplicate_risk && (
                        <TriangleAlert
                          className="size-3.5 shrink-0 text-warning"
                          aria-label="At reorder point while under repair"
                        />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.material_description}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.plant}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      row.reorder_triggered ? "font-medium text-warning" : "text-foreground"
                    )}
                  >
                    {row.stock_on_hand}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.reorder_point ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {row.quantity_under_repair}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {row.repair_po_number ?? row.repair_pr_number ?? "—"}
                    {!row.repair_po_number && (
                      <div className="text-xs text-muted-foreground">awaiting dispatch</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {row.vendor ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.overdue ? (
                      <StatusBadge tone="danger">{row.days_overdue}d overdue</StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">{row.expected_return ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.days_open ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.declarations_pending > 0 ? (
                      <StatusBadge tone="warning">
                        {row.declarations_pending} pending
                      </StatusBadge>
                    ) : row.declarations_complete > 0 ? (
                      <StatusBadge tone="success">Declared</StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
