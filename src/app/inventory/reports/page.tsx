"use client"

import { useMemo, useState } from "react"
import { History } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { RecommendationModal } from "@/components/inventory/RecommendationModal"
import { Badge, KPIChip, PillSelect, SearchBox } from "@/components/inventory/ui/primitives"
import { COLORS, type ColorTone } from "@/lib/inventory/ui/colors"
import { ADJUSTABLE_FIELD_LABELS, APPROVAL_CHAIN, APPROVAL_STAGE_LABELS } from "@/lib/inventory/approvals"
import { formatDateTime } from "@/lib/inventory/format"
import type { Recommendation } from "@/lib/inventory/calc/types"

type LedgerAction = "Sent for approval" | "Approved" | "Adjusted" | "Rejected"

interface LedgerRow {
  key: string
  materialId: string
  materialCode: string
  description: string
  user: string
  action: LedgerAction
  /** What actually moved, one line per field -- empty when the action changed no numbers. */
  changes: string[]
  time: string
  reason: string
}

const ACTION_COLOR: Record<LedgerAction, ColorTone> = {
  "Sent for approval": "warning",
  Approved: "success",
  Adjusted: "purple",
  Rejected: "danger",
}

/** The full SS/ROP/Max movement this recommendation represents -- used for both the
 * "sent" row (proposed) and the "approved" row (applied), so the ledger always says what
 * the change actually was rather than leaving the column blank. */
function proposedChanges(rec: Recommendation): string[] {
  return [
    `SS ${rec.current.currentSafetyStock} -> ${rec.current.recommendedSafetyStock}`,
    `ROP ${rec.current.currentROP} -> ${rec.current.recommendedROP}`,
    `Max ${rec.current.currentMaxStock} -> ${rec.current.recommendedMaxStockOptionA}`,
  ]
}

export default function InventoryReportsPage() {
  const { recommendations, loading, error, approvals } = useInventory()
  const [action, setAction] = useState<"All" | LedgerAction>("All")
  const [search, setSearch] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(recommendations.map((r) => [r.materialId, r])), [recommendations])

  const rows = useMemo(() => {
    const out: LedgerRow[] = []

    for (const entry of approvals.getAllEntries()) {
      const rec = byId.get(entry.materialId)
      if (!rec) continue
      const base = { materialId: entry.materialId, materialCode: rec.materialCode, description: rec.description }

      if (entry.sentAt && entry.sentBy) {
        out.push({
          ...base,
          key: `${entry.materialId}-sent`,
          user: entry.sentBy,
          action: "Sent for approval",
          changes: proposedChanges(rec),
          time: entry.sentAt,
          reason: "Submitted for approval -- proposed levels above",
        })
      }

      entry.adjustments.forEach((a, i) => {
        out.push({
          ...base,
          key: `${entry.materialId}-adjust-${i}`,
          user: a.by,
          action: "Adjusted",
          changes: [`${ADJUSTABLE_FIELD_LABELS[a.field]} ${a.recommended} -> ${a.adjusted}`],
          time: a.at,
          reason: a.reason,
        })
      })

      // One row per stage sign-off -- the ledger records who approved at which step, rather
      // than a single "approved" row that hides which roles actually signed.
      entry.stageApprovals.forEach((s, i) => {
        const isFinal = i === APPROVAL_CHAIN.length - 1
        out.push({
          ...base,
          key: `${entry.materialId}-stage-${s.stage}`,
          user: s.by,
          action: "Approved",
          changes: isFinal ? proposedChanges(rec) : [],
          time: s.at,
          reason: isFinal
            ? `Final sign-off as ${APPROVAL_STAGE_LABELS[s.stage]} -- levels applied`
            : `Signed off as ${APPROVAL_STAGE_LABELS[s.stage]}`,
        })
      })

      if (entry.status === "REJECTED" && entry.decidedBy && entry.decidedAt) {
        out.push({
          ...base,
          key: `${entry.materialId}-rejected`,
          user: entry.decidedBy,
          action: "Rejected",
          changes: [],
          time: entry.decidedAt,
          reason: entry.rejectionReason ?? "--",
        })
      }
    }

    return out.sort((a, b) => b.time.localeCompare(a.time))
  }, [byId, approvals])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (action !== "All" && r.action !== action) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!r.materialCode.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q) && !r.user.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, action, search])

  const counts = useMemo(() => {
    const c: Record<LedgerAction, number> = { "Sent for approval": 0, Approved: 0, Adjusted: 0, Rejected: 0 }
    for (const r of rows) c[r.action]++
    return c
  }, [rows])

  const detailRow = detailId ? (byId.get(detailId) ?? null) : null

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState />

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Reports</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            Audit ledger -- what changed, who did it, when, and why. Open a row for the full recommendation.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KPIChip label="Approved" value={counts.Approved} tone="neutral" />
          <KPIChip label="Adjusted" value={counts.Adjusted} tone="neutral" />
          <KPIChip label="Rejected" value={counts.Rejected} tone="danger" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search material, description, or person..." maxWidth={320} />
        <PillSelect
          value={action}
          onChange={(v) => setAction(v as typeof action)}
          options={[
            { value: "All", label: "All actions" },
            { value: "Sent for approval", label: "Sent for approval" },
            { value: "Approved", label: "Approved" },
            { value: "Adjusted", label: "Adjusted" },
            { value: "Rejected", label: "Rejected" },
          ]}
        />
      </div>

      <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <span style={{ width: 44, height: 44, borderRadius: 22, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <History size={20} color={COLORS.textLight} />
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>No approval activity yet</div>
            <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>
              Send a recommendation for approval and decide on it -- every action shows up here as a permanent, attributable record.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
              <thead>
                <tr style={{ background: COLORS.tableHeaderBg }}>
                  {["Material", "User", "Action", "What changed", "Time", "Reason"].map((h) => (
                    <th
                      key={h}
                      style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${COLORS.border}` }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.key} onClick={() => setDetailId(r.materialId)} style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ fontWeight: 700, color: COLORS.text }}>{r.materialCode}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap" }}>{r.user}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <Badge color={ACTION_COLOR[r.action]}>{r.action}</Badge>
                    </td>
                    <td style={{ padding: "9px 12px", color: COLORS.text, whiteSpace: "nowrap", lineHeight: 1.5, fontSize: 11.5 }}>
                      {r.changes.length === 0 ? <span style={{ color: COLORS.textMuted }}>No change applied</span> : r.changes.map((c) => <div key={c}>{c}</div>)}
                    </td>
                    <td style={{ padding: "9px 12px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{formatDateTime(r.time)}</td>
                    <td style={{ padding: "9px 12px", color: COLORS.textMuted, maxWidth: 240 }}>{r.reason}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                      No ledger entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailRow && <RecommendationModal rec={detailRow} mode="review" onClose={() => setDetailId(null)} />}
    </div>
  )
}
