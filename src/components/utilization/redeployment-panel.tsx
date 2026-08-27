"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ShoppingCart, X } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import {
  decideRedeployment,
  listRedeploymentRecommendations,
  listUnmatchedIssues,
  listUnusedStock,
  resolveUnmatchedIssue,
  type RedeploymentRecommendation,
  type UnmatchedIssue,
  type UnusedStockItem,
} from "@/lib/api/utilization"
import { formatQty } from "@/lib/utilization-format"
import { formatZAR } from "@/lib/utils"

const MATCH_TONE = { EXACT: "success", TIER1: "default", TIER2: "default" } as const
const MATCH_LABEL = { EXACT: "Exact material", TIER1: "Tier 1 alternate", TIER2: "Tier 2 alternate" } as const
const DECISION_TONE = { PENDING: "default", USE_EXISTING: "success", TRANSFER: "success", PURCHASE: "warning" } as const

function RecommendationsTable({ items, onDecide, actingOn }: { items: RedeploymentRecommendation[]; onDecide: (id: number, decision: "USE_EXISTING" | "TRANSFER" | "PURCHASE") => void; actingOn: number | null }) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No redeployment recommendations right now.</div>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requested material</TableHead>
            <TableHead>Existing material</TableHead>
            <TableHead>Plant (req → match)</TableHead>
            <TableHead>Match</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avoided value</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[220px] truncate text-foreground">{r.requested_material_description ?? "-"}</TableCell>
              <TableCell className="max-w-[220px] truncate text-foreground">{r.matched_material_description ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">{r.requested_plant} → {r.matched_plant}</TableCell>
              <TableCell><StatusBadge tone={MATCH_TONE[r.match_type]}>{MATCH_LABEL[r.match_type]}</StatusBadge></TableCell>
              <TableCell className="text-right text-foreground">{formatQty(r.matched_qty)}</TableCell>
              <TableCell className="text-right font-medium text-foreground">{formatZAR(r.avoided_value)}</TableCell>
              <TableCell><StatusBadge tone={DECISION_TONE[r.decision]}>{r.decision.replaceAll("_", " ")}</StatusBadge></TableCell>
              <TableCell>
                {r.decision === "PENDING" ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="xs" variant="outline" disabled={actingOn === r.id} className="border-success/40 text-success hover:bg-success/10" onClick={() => onDecide(r.id, r.requested_plant === r.matched_plant ? "USE_EXISTING" : "TRANSFER")}>
                      <Check className="size-3.5" /> {r.requested_plant === r.matched_plant ? "Use Existing Stock" : "Recommend Transfer"}
                    </Button>
                    <Button size="xs" variant="outline" disabled={actingOn === r.id} onClick={() => onDecide(r.id, "PURCHASE")}>
                      <ShoppingCart className="size-3.5" /> Continue Purchase
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Decided</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function UnusedStockTable({ items }: { items: UnusedStockItem[] }) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No released/unused stock currently available.</div>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Origin tracking ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="max-w-[260px] truncate text-foreground">{s.material_description ?? "-"} ({s.material_code})</TableCell>
              <TableCell className="text-muted-foreground">{s.plant}</TableCell>
              <TableCell className="text-right text-foreground">{formatQty(s.quantity)}</TableCell>
              <TableCell className="text-muted-foreground">{s.source === "RELEASED" ? "Released" : "Historical"}</TableCell>
              <TableCell className="text-muted-foreground">{s.source_tracking_id ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function UnmatchedIssuesPanel({ items, onResolve, actingOn }: { items: UnmatchedIssue[]; onResolve: (id: number, action: "CONFIRM" | "REJECT") => void; actingOn: number | null }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 text-sm font-medium text-foreground">Unmatched Issues Review</div>
      <p className="mb-3 text-xs text-muted-foreground">Goods issues that arrived without a reservation reference — a probable match is suggested; a human must confirm.</p>
      <div className="flex flex-col gap-3">
        {items.map((issue) => (
          <div key={issue.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-foreground">
                {issue.material_description} · {issue.plant} · Qty {formatQty(issue.quantity)} · {issue.issue_date}
              </div>
              {issue.confidence != null && <StatusBadge tone="default">{issue.confidence}% likely match</StatusBadge>}
            </div>
            {issue.suggested_tracking_id && (
              <p className="mt-1 text-[13px] text-muted-foreground">Suggested match: <span className="font-medium text-foreground">{issue.suggested_tracking_id}</span></p>
            )}
            {issue.signals.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-[12px] text-muted-foreground">
                {issue.signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="outline" disabled={actingOn === issue.id} className="border-success/40 text-success hover:bg-success/10" onClick={() => onResolve(issue.id, "CONFIRM")}>
                <Check className="size-3.5" /> Confirm Match
              </Button>
              <Button size="xs" variant="outline" disabled={actingOn === issue.id} className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => onResolve(issue.id, "REJECT")}>
                <X className="size-3.5" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RedeploymentPanel() {
  const [recommendations, setRecommendations] = useState<RedeploymentRecommendation[]>([])
  const [unusedStock, setUnusedStock] = useState<UnusedStockItem[]>([])
  const [unmatchedIssues, setUnmatchedIssues] = useState<UnmatchedIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [recs, stock, issues] = await Promise.all([
        listRedeploymentRecommendations(),
        listUnusedStock(),
        listUnmatchedIssues(),
      ])
      setRecommendations(recs)
      setUnusedStock(stock)
      setUnmatchedIssues(issues)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load redeployment data.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: number, decision: "USE_EXISTING" | "TRANSFER" | "PURCHASE") {
    setActingOn(id)
    try {
      const updated = await decideRedeployment(id, decision)
      setRecommendations((prev) => prev.map((r) => (r.id === id ? updated : r)))
      if (decision === "PURCHASE") toast.info("Continuing with purchase — no stock action recorded.")
      else toast.success(`${decision === "TRANSFER" ? "Inter-plant transfer" : "Use existing stock"} recommendation accepted.`)
      load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record decision.")
    } finally {
      setActingOn(null)
    }
  }

  async function resolveIssue(id: number, action: "CONFIRM" | "REJECT") {
    setActingOn(id)
    try {
      await resolveUnmatchedIssue(id, action)
      toast.success(action === "CONFIRM" ? "Match confirmed." : "Match rejected.")
      setUnmatchedIssues((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resolve.")
    } finally {
      setActingOn(null)
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-xl" />
  if (error) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 text-sm font-medium text-foreground">Redeployment recommendations</div>
        <RecommendationsTable items={recommendations} onDecide={decide} actingOn={actingOn} />
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-foreground">Released / unused stock pool</div>
        <UnusedStockTable items={unusedStock} />
      </div>
      <UnmatchedIssuesPanel items={unmatchedIssues} onResolve={resolveIssue} actingOn={actingOn} />
    </div>
  )
}
