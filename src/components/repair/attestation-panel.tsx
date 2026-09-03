"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ExternalLink, Search, ShieldCheck, X } from "lucide-react"
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
import { cn } from "@/lib/utils"

const ALL_FILTER = "all"
const ORIGINS = ["MANUAL", "MRP", "CHAT"] as const

const ORIGIN_LABEL: Record<string, string> = {
  MANUAL: "Requisitioner",
  MRP: "Auto (min/max)",
  CHAT: "AI assistant",
}

/** A deep link from the register or the approvals page narrows both tabs to one thing. */
interface TargetFilter {
  material: string | null
  plant: string | null
  rr: string | null
}

function hasTarget(t: TargetFilter) {
  return Boolean(t.material || t.plant || t.rr)
}

function describeTarget(t: TargetFilter) {
  const bits: string[] = []
  if (t.rr) bits.push(t.rr)
  if (t.material) bits.push(t.material)
  if (t.plant) bits.push(t.plant)
  return bits.join(" · ")
}

function TargetChip({ target, onClear }: { target: TargetFilter; onClear: () => void }) {
  if (!hasTarget(target)) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">Showing declarations for</span>
      <span className="text-sm font-medium text-foreground">{describeTarget(target)}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-3.5" />
        Show all
      </button>
    </div>
  )
}

/** The queue of auto-raised requisitions blocked at DOA until a planner declares. */
function PendingQueue({
  target,
  onClearTarget,
  onDeclared,
}: {
  target: TargetFilter
  onClearTarget: () => void
  onDeclared: () => void
}) {
  const [items, setItems] = useState<PendingDeclaration[]>([])
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<number | null>(null)
  const firstMatchRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await listPendingDeclarations(undefined, debounced || undefined))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load pending declarations.")
    } finally {
      setLoading(false)
    }
  }, [debounced])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (target.rr && i.rr_number !== target.rr) return false
      if (target.material && i.material_code !== target.material) return false
      if (target.plant && i.plant !== target.plant) return false
      return true
    })
  }, [items, target])

  // Arriving from a deep link to a single item: open its declare form straight away and
  // scroll to it, so the click that got here lands on the action rather than a list.
  useEffect(() => {
    if (!loading && hasTarget(target) && visible.length === 1) {
      setOpenRow(visible[0].attestation_id)
      firstMatchRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [loading, target, visible])

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

  // The search box stays mounted through loading and empty states -- otherwise a search
  // that matches nothing removes the only control that could undo it.
  const searchBox = (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search RR, material, or requester"
        className="h-9 pl-8"
      />
    </div>
  )

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {searchBox}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {searchBox}
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <TargetChip target={target} onClear={onClearTarget} />
        {searchBox}
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {debounced
            ? `No requisition awaiting a declaration matches "${debounced}".`
            : hasTarget(target)
              ? `Nothing is awaiting a declaration for ${describeTarget(target)}.`
              : "No requisitions are waiting on a declaration."}
          {debounced && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </div>
          )}
          {!debounced && hasTarget(target) && items.length > 0 && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={onClearTarget}>
                Show all {items.length} pending
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <TargetChip target={target} onClear={onClearTarget} />
      {searchBox}
      <p className="text-xs text-muted-foreground">
        {visible.length} auto-raised {visible.length === 1 ? "requisition" : "requisitions"} cannot
        be approved until a planner confirms the existing item is beyond repair.
      </p>
      {visible.map((item, index) => (
        <div
          key={item.attestation_id}
          ref={index === 0 ? firstMatchRef : undefined}
          className={cn(
            "rounded-xl border bg-card p-3",
            openRow === item.attestation_id ? "border-foreground/40" : "border-border"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{item.rr_number}</span>
                <StatusBadge tone="warning">Declaration pending</StatusBadge>
                <StatusBadge tone="default">
                  {ORIGIN_LABEL[item.origin ?? ""] ?? item.origin}
                </StatusBadge>
                {item.duplicate_flag && <StatusBadge tone="danger">Duplicate risk</StatusBadge>}
              </div>
              <p className="mt-1 text-sm text-foreground">
                <Link
                  href={`/repair-register?search=${encodeURIComponent(item.material_code ?? "")}`}
                  className="text-primary hover:underline"
                >
                  {item.material_code}
                </Link>{" "}
                — {item.material_description}
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
                  autoFocus
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
                approver. This unblocks its approval.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The full declaration log — who declared what, when, against which requisition. */
function DeclarationLog({
  target,
  onClearTarget,
  refreshKey,
}: {
  target: TargetFilter
  onClearTarget: () => void
  refreshKey: number
}) {
  const [status, setStatus] = useState<string>(ALL_FILTER)
  const [origin, setOrigin] = useState<string>(ALL_FILTER)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [items, setItems] = useState<Attestation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(
        await listAttestations({
          status: status === ALL_FILTER ? undefined : status,
          origin: origin === ALL_FILTER ? undefined : origin,
          plant: target.plant ?? undefined,
          search: debounced || undefined,
        })
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the declaration log.")
    } finally {
      setLoading(false)
    }
  }, [status, origin, target.plant, debounced])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const visible = useMemo(() => {
    return items.filter((a) => {
      if (target.rr && a.rr_number !== target.rr) return false
      if (target.material && a.material_code !== target.material) return false
      return true
    })
  }, [items, target])

  return (
    <div className="flex flex-col gap-3">
      <TargetChip target={target} onClear={onClearTarget} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RR, material, or declarer"
            className="h-9 pl-8"
          />
        </div>
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
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{visible.length} declarations</p>
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
              {visible.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-foreground">
                    {a.rr_number ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <Link
                      href={`/repair-register?search=${encodeURIComponent(a.material_code ?? "")}`}
                      className="text-primary hover:underline"
                    >
                      {a.material_code}
                    </Link>
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
  const router = useRouter()
  const params = useSearchParams()

  const target: TargetFilter = useMemo(
    () => ({
      material: params.get("material"),
      plant: params.get("plant"),
      rr: params.get("rr"),
    }),
    [params]
  )

  const [tab, setTab] = useState<"pending" | "log">(() =>
    params.get("tab") === "log" ? "log" : "pending"
  )
  const [refreshKey, setRefreshKey] = useState(0)

  function clearTarget() {
    router.replace(`/declarations?tab=${tab}`, { scroll: false })
  }

  function selectTab(next: "pending" | "log") {
    setTab(next)
    const q = new URLSearchParams()
    if (target.material) q.set("material", target.material)
    if (target.plant) q.set("plant", target.plant)
    if (target.rr) q.set("rr", target.rr)
    q.set("tab", next)
    router.replace(`/declarations?${q.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-border">
        {(
          [
            ["pending", "Awaiting declaration"],
            ["log", "Declaration log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={
              tab === key
                ? "-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium text-foreground"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
        <Link
          href="/repair-register"
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Repair register
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {tab === "pending" ? (
        <PendingQueue
          target={target}
          onClearTarget={clearTarget}
          onDeclared={() => setRefreshKey((k) => k + 1)}
        />
      ) : (
        <DeclarationLog
          target={target}
          onClearTarget={clearTarget}
          refreshKey={refreshKey}
        />
      )}
    </div>
  )
}
