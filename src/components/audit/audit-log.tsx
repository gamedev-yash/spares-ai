"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

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
import { getAuditFacets, searchAuditLogs, type AuditLogEntry } from "@/lib/api/audit"
import { downloadCsv } from "@/lib/utils"

const ALL_FILTER = "all"
const PAGE_SIZE = 50

function formatDetail(entry: AuditLogEntry): string {
  const parts: string[] = []
  if (entry.new_value) parts.push(`new: ${JSON.stringify(entry.new_value)}`)
  if (entry.old_value) parts.push(`old: ${JSON.stringify(entry.old_value)}`)
  return parts.length ? parts.join(" | ") : "-"
}

export function AuditLog() {
  const [entityType, setEntityType] = useState(ALL_FILTER)
  const [action, setAction] = useState(ALL_FILTER)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)

  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])

  useEffect(() => {
    getAuditFacets()
      .then((facets) => {
        setEntityTypes(facets.entity_types)
        setActions(facets.actions)
      })
      .catch(() => {
        setEntityTypes([])
        setActions([])
      })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [entityType, action, dateFrom, dateTo])

  const filters = useMemo(
    () => ({
      entity_type: entityType === ALL_FILTER ? undefined : entityType,
      action: action === ALL_FILTER ? undefined : action,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [entityType, action, dateFrom, dateTo]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchAuditLogs({ ...filters, page, page_size: PAGE_SIZE })
      setEntries(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit log.")
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function handleExport() {
    try {
      const result = await searchAuditLogs({ ...filters, page: 1, page_size: 1000 })
      downloadCsv(
        "spares-ai-audit-log.csv",
        ["Timestamp", "Entity Type", "Entity ID", "Action", "Actor", "Detail"],
        result.items.map((e) => [
          e.timestamp,
          e.entity_type,
          String(e.entity_id ?? ""),
          e.action,
          e.actor_name ?? "System",
          formatDetail(e),
        ])
      )
      toast.success(`Exported ${result.items.length} of ${result.total} matching audit entries to CSV`)
    } catch {
      toast.error("Failed to export audit log.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={entityType} onValueChange={(value) => setEntityType(value ?? ALL_FILTER)}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Entity type">
                {(value: string) => (value === ALL_FILTER ? "All entities" : value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All entities</SelectItem>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={(value) => setAction(value ?? ALL_FILTER)}>
            <SelectTrigger className="h-9 w-full sm:w-48">
              <SelectValue placeholder="Action">
                {(value: string) => (value === ALL_FILTER ? "All actions" : value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-full sm:w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-full sm:w-40"
            aria-label="To date"
          />
        </div>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export to CSV
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} audit entries</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id
                return (
                  <Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      aria-expanded={isExpanded}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {entry.entity_type}
                        {entry.entity_id != null ? `-${entry.entity_id}` : ""}
                      </TableCell>
                      <TableCell className="text-foreground">{entry.action}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.actor_name ?? "System"}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground">
                        {formatDetail(entry)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell />
                        <TableCell
                          colSpan={5}
                          className="bg-muted/30 py-3 text-xs whitespace-normal text-foreground"
                        >
                          {formatDetail(entry)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
