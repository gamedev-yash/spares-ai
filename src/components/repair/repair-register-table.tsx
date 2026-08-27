"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight, Download, ExternalLink, Search, TriangleAlert } from "lucide-react"

import { EconomicComparison } from "@/components/repair/economic-comparison"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
  getRepairEconomics,
  getRepairPlants,
  getRepairRegister,
  type EconomicEvaluation,
  type RepairRegister,
  type RepairRegisterRow,
} from "@/lib/api/repair"
import { cn, downloadCsv, formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"

type RegisterStatus = "OVERDUE" | "IN_FLIGHT" | "REORDER_TRIGGERED"

const STATUS_OPTIONS = [
  { value: "IN_FLIGHT", label: "At vendor, on time" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "REORDER_TRIGGERED", label: "At reorder point" },
] as const

function rowKey(r: RepairRegisterRow) {
  return `${r.material_id}-${r.repair_po_id ?? r.repair_pr_id ?? "x"}`
}

/**
 * KPI tiles double as filters -- the numbers people ask about ("which twelve are
 * overdue?") are the same numbers they want to drill into, so the tile is the control.
 */
function KpiTile({
  label,
  value,
  hint,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "warning" | "danger"
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
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
    </>
  )

  if (!onClick) {
    return <div className="rounded-xl border border-border bg-card p-3">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border bg-card p-3 text-left transition-colors",
        "hover:border-foreground/30 hover:bg-muted/50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-foreground/50 bg-muted/60" : "border-border"
      )}
    >
      {body}
    </button>
  )
}

/** Expanded detail for one chain: the trade-off, and where to go next. */
function ChainDetail({ row }: { row: RepairRegisterRow }) {
  const [economics, setEconomics] = useState<EconomicEvaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getRepairEconomics(row.material_id, row.plant ?? undefined)
      .then((e) => {
        if (!cancelled) setEconomics(e)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load the comparison.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row.material_id, row.plant])

  const declarationHref = `/declarations?material=${encodeURIComponent(
    row.material_code ?? ""
  )}&plant=${encodeURIComponent(row.plant ?? "")}&tab=${
    row.declarations_pending > 0 ? "pending" : "log"
  }`

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            The repair
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Requisition</dt>
            <dd className="text-foreground">{row.repair_pr_number ?? "—"}</dd>
            <dt className="text-muted-foreground">Order</dt>
            <dd className="text-foreground">{row.repair_po_number ?? "not yet raised"}</dd>
            <dt className="text-muted-foreground">Vendor</dt>
            <dd className="text-foreground">{row.vendor ?? "not yet assigned"}</dd>
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="text-foreground">
              {row.stage === "AT_VENDOR" ? "At vendor" : "Awaiting dispatch"}
            </dd>
            <dt className="text-muted-foreground">Opened</dt>
            <dd className="text-foreground">
              {row.opened_at ?? "—"}
              {row.days_open != null ? ` · ${row.days_open} days ago` : ""}
            </dd>
            <dt className="text-muted-foreground">Value</dt>
            <dd className="text-foreground">{formatZAR(row.repair_value)}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Inventory position
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Stock on hand</dt>
            <dd className="text-foreground">
              {row.stock_on_hand} {row.unit_of_measure ?? ""}
            </dd>
            <dt className="text-muted-foreground">Reorder point</dt>
            <dd className="text-foreground">{row.reorder_point ?? "—"}</dd>
            <dt className="text-muted-foreground">At vendor</dt>
            <dd className="text-foreground">{row.quantity_under_repair}</dd>
            <dt className="text-muted-foreground">Criticality</dt>
            <dd className="text-foreground">{row.criticality ?? "—"}</dd>
            <dt className="text-muted-foreground">New unit cost</dt>
            <dd className="text-foreground">{formatZAR(row.new_unit_cost)}</dd>
            <dt className="text-muted-foreground">New lead time</dt>
            <dd className="text-foreground">{row.new_lead_time_days} days</dd>
          </dl>
          {row.reorder_triggered && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              Stock is at or below the reorder point while the unit is still at the vendor. This
              is the condition that produces a duplicate order.
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : error ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : economics ? (
        <EconomicComparison economics={economics} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={declarationHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {row.declarations_pending > 0
            ? `Declare (${row.declarations_pending} pending)`
            : "View declarations"}
          <ExternalLink className="size-3.5" />
        </Link>
        <Link
          href={`/materials?q=${encodeURIComponent(row.material_code ?? "")}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Material details
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}

export function RepairRegisterTable() {
  const router = useRouter()
  const params = useSearchParams()

  // Seed from the URL once, so deep links like ?search=RPO-3041 or ?status=OVERDUE work
  // from the approvals page and the duplicate alert.
  const [plant, setPlant] = useState<string>(() => params.get("plant") ?? ALL_FILTER)
  const [status, setStatus] = useState<string>(() => params.get("status") ?? ALL_FILTER)
  const [search, setSearch] = useState(() => params.get("search") ?? "")
  const [debounced, setDebounced] = useState(() => params.get("search") ?? "")

  const [plants, setPlants] = useState<string[]>([])
  const [data, setData] = useState<RepairRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    getRepairPlants()
      .then(setPlants)
      .catch(() => setPlants([]))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Keep the URL in step with the filters so any view can be linked or shared.
  const queryString = useMemo(() => {
    const q = new URLSearchParams()
    if (plant !== ALL_FILTER) q.set("plant", plant)
    if (status !== ALL_FILTER) q.set("status", status)
    if (debounced) q.set("search", debounced)
    return q.toString()
  }, [plant, status, debounced])

  useEffect(() => {
    router.replace(queryString ? `/repair-register?${queryString}` : "/repair-register", {
      scroll: false,
    })
  }, [queryString, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        await getRepairRegister({
          plant: plant === ALL_FILTER ? undefined : plant,
          status: status === ALL_FILTER ? undefined : (status as RegisterStatus),
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

  function toggleStatus(next: RegisterStatus) {
    setStatus((current) => (current === next ? ALL_FILTER : next))
    setExpanded(null)
  }

  function clearFilters() {
    setStatus(ALL_FILTER)
    setPlant(ALL_FILTER)
    setSearch("")
    setExpanded(null)
  }

  function exportCsv(rows: RepairRegisterRow[]) {
    downloadCsv(
      "repair-register.csv",
      [
        "Material", "Description", "Plant", "Stock on hand", "Reorder point",
        "Qty under repair", "Repair document", "Vendor", "Expected return",
        "Days open", "Overdue", "Declarations pending",
      ],
      rows.map((r) => [
        r.material_code ?? "", r.material_description ?? "", r.plant ?? "",
        r.stock_on_hand, r.reorder_point ?? "", r.quantity_under_repair,
        r.repair_po_number ?? r.repair_pr_number ?? "", r.vendor ?? "",
        r.expected_return ?? "", r.days_open ?? "", r.overdue ? "Yes" : "No",
        r.declarations_pending,
      ])
    )
  }

  const summary = data?.summary
  const filtered = status !== ALL_FILTER || plant !== ALL_FILTER || Boolean(debounced)

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <KpiTile
            label="Out for repair"
            value={String(summary.open_chain_count)}
            hint={`${summary.total_quantity_under_repair} units at vendors`}
            active={!filtered}
            onClick={clearFilters}
          />
          <KpiTile
            label="Value in flight"
            value={formatZAR(summary.total_value_under_repair)}
            hint="Committed repair spend"
          />
          <KpiTile
            label="Overdue"
            value={String(summary.overdue_count)}
            hint={status === "OVERDUE" ? "Filtering — click to clear" : "Past expected return"}
            tone={summary.overdue_count > 0 ? "danger" : "default"}
            active={status === "OVERDUE"}
            onClick={() => toggleStatus("OVERDUE")}
          />
          <KpiTile
            label="At reorder point"
            value={String(summary.duplicate_risk_count)}
            hint={
              status === "REORDER_TRIGGERED"
                ? "Filtering — click to clear"
                : "Could be ordered again"
            }
            tone={summary.duplicate_risk_count > 0 ? "warning" : "default"}
            active={status === "REORDER_TRIGGERED"}
            onClick={() => toggleStatus("REORDER_TRIGGERED")}
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
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
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
            {data.total} open repair {data.total === 1 ? "chain" : "chains"} · click a row for the
            repair-versus-new comparison
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
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
              {data.items.map((row) => {
                const key = rowKey(row)
                const isOpen = expanded === key
                return (
                  <Fragment key={key}>
                    <TableRow
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className={cn(
                        "cursor-pointer",
                        row.duplicate_risk && "bg-warning/5",
                        isOpen && "bg-muted/60"
                      )}
                    >
                      <TableCell className="text-muted-foreground">
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/materials?q=${encodeURIComponent(row.material_code ?? "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.material_code}
                          </Link>
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
                          <span className="text-muted-foreground">
                            {row.expected_return ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.days_open ?? "—"}
                      </TableCell>
                      <TableCell>
                        {/* The declaration status is the hand-off point: pending means someone
                            has to act, so it links straight to where they act. */}
                        {row.declarations_pending > 0 ? (
                          <Link
                            href={`/declarations?material=${encodeURIComponent(
                              row.material_code ?? ""
                            )}&plant=${encodeURIComponent(row.plant ?? "")}&tab=pending`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            title="Go to the declaration queue for this material"
                          >
                            <StatusBadge
                              tone="warning"
                              className="cursor-pointer hover:bg-warning/25"
                            >
                              {row.declarations_pending} pending
                            </StatusBadge>
                          </Link>
                        ) : row.declarations_complete > 0 ? (
                          <Link
                            href={`/declarations?material=${encodeURIComponent(
                              row.material_code ?? ""
                            )}&plant=${encodeURIComponent(row.plant ?? "")}&tab=log`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            title="View the declarations for this material"
                          >
                            <StatusBadge
                              tone="success"
                              className="cursor-pointer hover:bg-success/25"
                            >
                              Declared
                            </StatusBadge>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={11} className="bg-muted/30 pt-0">
                          <ChainDetail row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
