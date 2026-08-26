"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { DuplicateContextAlert } from "@/components/repair/duplicate-alert"
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
  declareAttestation,
  listAttestations,
  listPendingDeclarations,
  type Attestation,
  type PendingDeclaration,
} from "@/lib/api/repair"

const ALL_FILTER = "all"
const ORIGINS = ["MANUAL", "MRP", "CHAT"] as const

const ORIGIN_LABEL: Record<string, string> = {
  MANUAL: "Requisitioner",
  MRP: "Auto (min/max)",
  CHAT: "AI assistant",
}

/** The queue of auto-raised requisitions blocked at DOA until a planner declares. */
function PendingQueue({ onDeclared }: { onDeclared: () => void }) {
  const [items, setItems] = useState<PendingDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await listPendingDeclarations())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load pending declarations.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function declare(item: PendingDeclaration) {
    setBusy(item.attestation_id)
    try {
      await declareAttestation(item.attestation_id, note.trim() || undefined)
      toast.success(`Declaration recorded — ${item.rr_number}`)
      setItems((prev) => prev.filter((i) => i.attestation_id !== item.attestation_id))
      setOpenRow(null)
      setNote("")
      onDeclared()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record the declaration.")
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <Skeleton className="h-56 rounded-xl" />
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No requisitions are waiting on a declaration.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {items.length} auto-raised {items.length === 1 ? "requisition" : "requisitions"} cannot
        be approved until a planner confirms the existing item is beyond repair.
      </p>
      {items.map((item) => (
        <div key={item.attestation_id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{item.rr_number}</span>
                <StatusBadge tone="warning">Declaration pending</StatusBadge>
                <StatusBadge tone="default">{ORIGIN_LABEL[item.origin ?? ""] ?? item.origin}</StatusBadge>
                {item.duplicate_flag && <StatusBadge tone="danger">Duplicate risk</StatusBadge>}
              </div>
              <p className="mt-1 text-sm text-foreground">
                {item.material_code} — {item.material_description}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.plant} · {item.department} · raised by {item.requester ?? "MRP"} ·{" "}
                {item.rr_status}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-success/40 text-success hover:bg-success/10"
              disabled={busy === item.attestation_id}
              onClick={() =>
                setOpenRow(openRow === item.attestation_id ? null : item.attestation_id)
              }
            >
              <ShieldCheck className="size-3.5" />
              Declare
            </Button>
          </div>

          {item.chain_snapshot && (
            <DuplicateContextAlert context={item.chain_snapshot} className="mt-2.5" />
          )}

          {openRow === item.attestation_id && (
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm text-foreground">
                I confirm the existing item has been assessed and cannot be repaired.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional — why it can't be repaired"
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={busy === item.attestation_id}
                  onClick={() => declare(item)}
                >
                  <Check className="size-3.5" />
                  Confirm declaration
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Recorded against {item.rr_number} with your name and the time, and shown to the
                approver.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The full declaration log — who declared what, when, against which requisition. */
function DeclarationLog({ refreshKey }: { refreshKey: number }) {
  const [status, setStatus] = useState<string>(ALL_FILTER)
  const [origin, setOrigin] = useState<string>(ALL_FILTER)
  const [items, setItems] = useState<Attestation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(
        await listAttestations({
          status: status === ALL_FILTER ? undefined : status,
          origin: origin === ALL_FILTER ? undefined : origin,
        })
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the declaration log.")
    } finally {
      setLoading(false)
    }
  }, [status, origin])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={status} onValueChange={(v) => setStatus((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Status">
              {(value: string) => (value === ALL_FILTER ? "All statuses" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            <SelectItem value="COMPLETE">Complete</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={(v) => setOrigin((v as string) ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Origin">
              {(value: string) =>
                value === ALL_FILTER ? "All origins" : (ORIGIN_LABEL[value] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All origins</SelectItem>
            {ORIGINS.map((o) => (
              <SelectItem key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{items.length} declarations</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RR</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Declared by</TableHead>
                <TableHead>Declared at</TableHead>
                <TableHead>Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">
                    {a.rr_number ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="text-foreground">{a.material_code}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.material_description}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.plant ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ORIGIN_LABEL[a.origin ?? ""] ?? a.origin ?? "—"}
                  </TableCell>
                  <TableCell>
                    {a.status === "COMPLETE" ? (
                      <StatusBadge tone="success">Declared</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Pending</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.declared_by_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.declared_at ? new Date(a.declared_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {a.duplicate_flag ? (
                      <StatusBadge tone="danger">Duplicate</StatusBadge>
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

export function AttestationPanel() {
  const [tab, setTab] = useState<"pending" | "log">("pending")
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["pending", "Awaiting declaration"],
            ["log", "Declaration log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium text-foreground"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <PendingQueue onDeclared={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <DeclarationLog refreshKey={refreshKey} />
      )}
    </div>
  )
}
