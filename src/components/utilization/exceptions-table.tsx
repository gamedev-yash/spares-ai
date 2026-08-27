"use client"

import { useCallback, useEffect, useState } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { listExceptions, resolveException, type UtilizationException } from "@/lib/api/utilization"
import { EXCEPTION_SEVERITY_TONE, EXCEPTION_TYPE_LABELS } from "@/lib/utilization-format"

const ALL_FILTER = "all"
const PAGE_SIZE = 50
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const
const TYPES = Object.keys(EXCEPTION_TYPE_LABELS)

export function ExceptionsTable() {
  const [severity, setSeverity] = useState<string>(ALL_FILTER)
  const [type, setType] = useState<string>(ALL_FILTER)
  const [items, setItems] = useState<UtilizationException[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listExceptions({
        severity: severity === ALL_FILTER ? undefined : severity,
        type: type === ALL_FILTER ? undefined : type,
        status: "OPEN",
        page_size: PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load exceptions.")
    } finally {
      setLoading(false)
    }
  }, [severity, type])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(item: UtilizationException) {
    if (item.id < 0) {
      toast.info("This exception clears automatically once the linked record is actioned — open it from the Utilization Tracker.")
      return
    }
    setActingOn(item.id)
    try {
      await resolveException(item.id)
      toast.success(`Resolved — ${EXCEPTION_TYPE_LABELS[item.type] ?? item.type}`)
      setItems((prev) => prev.filter((e) => e.id !== item.id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resolve.")
    } finally {
      setActingOn(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={severity} onValueChange={(v) => setSeverity((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Severity">{(v: string) => (v === ALL_FILTER ? "All severities" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All severities</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-64">
            <SelectValue placeholder="Type">{(v: string) => (v === ALL_FILTER ? "All exception types" : EXCEPTION_TYPE_LABELS[v] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All exception types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{EXCEPTION_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No open exceptions match these filters.</div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} open exception(s)</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Plant / Dept</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">{item.tracking_id}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{item.material_description ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{EXCEPTION_TYPE_LABELS[item.type] ?? item.type}</TableCell>
                    <TableCell><StatusBadge tone={EXCEPTION_SEVERITY_TONE[item.severity]}>{item.severity}</StatusBadge></TableCell>
                    <TableCell className="text-muted-foreground">{item.plant} · {item.department}</TableCell>
                    <TableCell className="text-muted-foreground">{item.requester_name ?? "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">{item.note ?? "-"}</TableCell>
                    <TableCell>
                      <Button size="xs" variant="outline" disabled={actingOn === item.id} className="border-success/40 text-success hover:bg-success/10" onClick={() => resolve(item)}>
                        <Check className="size-3.5" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
