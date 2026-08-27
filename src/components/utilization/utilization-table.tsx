"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { listUtilization, type UtilizationRecord, type UtilizationStage } from "@/lib/api/utilization"
import { AGING_TONE, RISK_TONE, STAGE_LABELS, STAGE_TONE, formatQty } from "@/lib/utilization-format"

const ALL_FILTER = "all"
const PAGE_SIZE = 25

const STAGE_OPTIONS = Object.keys(STAGE_LABELS) as UtilizationStage[]
const AGING_OPTIONS = ["Healthy", "Due Soon", "Due Today", "Overdue", "Critical"] as const
const PLANT_OPTIONS = ["Gamsberg", "BMM"] as const

export function UtilizationTable() {
  const router = useRouter()
  const [stage, setStage] = useState<string>(ALL_FILTER)
  const [plant, setPlant] = useState<string>(ALL_FILTER)
  const [aging, setAging] = useState<string>(ALL_FILTER)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<UtilizationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listUtilization({
        stage: stage === ALL_FILTER ? undefined : stage,
        plant: plant === ALL_FILTER ? undefined : plant,
        aging_severity: aging === ALL_FILTER ? undefined : aging,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the utilization ledger.")
    } finally {
      setLoading(false)
    }
  }, [stage, plant, aging, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={plant} onValueChange={(v) => { setPlant((v as string) ?? ALL_FILTER); setPage(1) }}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Plant">{(v: string) => (v === ALL_FILTER ? "All plants" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plants</SelectItem>
            {PLANT_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={aging} onValueChange={(v) => { setAging((v as string) ?? ALL_FILTER); setPage(1) }}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Aging">{(v: string) => (v === ALL_FILTER ? "All aging" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All aging</SelectItem>
            {AGING_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={(v) => { setStage((v as string) ?? ALL_FILTER); setPage(1) }}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Stage">{(v: string) => (v === ALL_FILTER ? "All stages" : STAGE_LABELS[v as UtilizationStage])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All stages</SelectItem>
            {STAGE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No utilization records match these filters.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} reservation line(s)</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Plant / Dept</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Fulfilled</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Aging</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/utilization/${item.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {item.tracking_id}
                      {item.shared_allocation && (
                        <StatusBadge tone="default" className="ml-2">Shared Allocation</StatusBadge>
                      )}
                      {item.historical && (
                        <StatusBadge tone="default" className="ml-2">Historical</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-foreground">
                      {item.material_description ?? "-"}
                      {item.fulfilment_leg === "STORES" && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">(stores leg)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.requester_name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.plant} · {item.department}</TableCell>
                    <TableCell className="text-right text-foreground">{formatQty(item.qty_requested)}</TableCell>
                    <TableCell className="text-right text-foreground">{formatQty(item.qty_fulfilled)}</TableCell>
                    <TableCell className="text-right text-foreground">{formatQty(item.qty_consumed)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.planned_consumption_date}</TableCell>
                    <TableCell>
                      <StatusBadge tone={STAGE_TONE[item.stage]}>{STAGE_LABELS[item.stage]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={AGING_TONE[item.aging_severity]}>{item.aging_severity}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {item.risk_level ? (
                        <StatusBadge tone={RISK_TONE[item.risk_level]}>{item.risk_level}</StatusBadge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
