"use client"

import { useCallback, useEffect, useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import { searchNotifications, type NotificationEntry } from "@/lib/api/notifications"

const ALL_FILTER = "all"
const PAGE_SIZE = 50

export function NotificationList() {
  const [status, setStatus] = useState(ALL_FILTER)
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<NotificationEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchNotifications({
        status: status === ALL_FILTER ? undefined : status,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notifications.")
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Select value={status} onValueChange={(value) => setStatus(value ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Status">
              {(value: string) => (value === ALL_FILTER ? "All notifications" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All notifications</SelectItem>
            <SelectItem value="UNREAD">Unread</SelectItem>
            <SelectItem value="READ">Read</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{total} notifications</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No notifications to show.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <StatusBadge tone={n.status === "UNREAD" ? "warning" : "default"}>
                  {n.status}
                </StatusBadge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  {n.related_entity_type && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Related: {n.related_entity_type}
                      {n.related_entity_id != null ? `-${n.related_entity_id}` : ""}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
