"use client"

import { useMemo, useState } from "react"
import { History, Send, CheckCircle2, SlidersHorizontal, XCircle } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { Badge, KPIChip, PillSelect, SearchBox } from "@/components/inventory/ui/primitives"
import { COLORS, type ColorTone } from "@/lib/inventory/ui/colors"
import { ADJUSTABLE_FIELD_LABELS } from "@/lib/inventory/approvals"
import { formatDateTime } from "@/lib/inventory/format"

type LedgerAction = "Sent for approval" | "Approved" | "Adjusted" | "Rejected"

interface LedgerRow {
  key: string
  materialId: string
  materialCode: string
  description: string
  user: string
  action: LedgerAction
  field: string | null
  oldValue: number | null
  newValue: number | null
  time: string
  reason: string
}

const ACTION_META: Record<LedgerAction, { color: ColorTone; icon: typeof Send }> = {
  "Sent for approval": { color: "warning", icon: Send },
  Approved: { color: "success", icon: CheckCircle2 },
  Adjusted: { color: "purple", icon: SlidersHorizontal },
  Rejected: { color: "danger", icon: XCircle },
}

export default function InventoryReportsPage() {
  const { recommendations, loading, error, approvals } = useInventory()
  const [action, setAction] = useState<"All" | LedgerAction>("All")
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const recByMaterial = new Map(recommendations.map((r) => [r.materialId, r]))
    const out: LedgerRow[] = []

    for (const entry of approvals.getAllEntries()) {
      const rec = recByMaterial.get(entry.materialId)
      if (!rec) continue

      if (entry.sentAt && entry.sentBy) {
        out.push({
          key: `${entry.materialId}-sent`,
          materialId: entry.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          user: entry.sentBy,
          action: "Sent for approval",
          field: null,
          oldValue: null,
          newValue: null,
          time: entry.sentAt,
          reason: "--",
        })
      }

      entry.adjustments.forEach((a, i) => {
        out.push({
          key: `${entry.materialId}-adjust-${i}`,
          materialId: entry.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          user: a.by,
          action: "Adjusted",
          field: ADJUSTABLE_FIELD_LABELS[a.field],
          oldValue: a.recommended,
          newValue: a.adjusted,
          time: a.at,
          reason: a.reason,
        })
      })

      if (entry.status === "APPROVED" && entry.decidedBy && entry.decidedAt) {
        out.push({
          key: `${entry.materialId}-approved`,
          materialId: entry.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          user: entry.decidedBy,
          action: "Approved",
          field: "Reorder Point",
          oldValue: rec.current.currentROP,
          newValue: rec.current.recommendedROP,
          time: entry.decidedAt,
          reason: "Approved based on recommendation",
        })
      }

      if (entry.status === "REJECTED" && entry.decidedBy && entry.decidedAt) {
        out.push({
          key: `${entry.materialId}-rejected`,
          materialId: entry.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          user: entry.decidedBy,
          action: "Rejected",
          field: null,
          oldValue: null,
          newValue: null,
          time: entry.decidedAt,
          reason: entry.rejectionReason ?? "--",
        })
      }
    }

    return out.sort((a, b) => b.time.localeCompare(a.time))
  }, [recommendations, approvals])

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

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState />

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Reports</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            Audit ledger -- every send, approve, adjust, and reject, with who did it, when, and why
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KPIChip label="Approved" value={counts.Approved} tone="neutral" />
          <KPIChip label="Adjusted" value={counts.Adjusted} tone="neutral" />
          <KPIChip label="Rejected" value={counts.Rejected} tone="warning" />
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
                  {["Material", "User", "Action", "Field", "Old -> New", "Time", "Reason"].map((h) => (
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
                {filteredRows.map((r) => {
                  const meta = ACTION_META[r.action]
                  return (
                    <tr key={r.key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ fontWeight: 700, color: COLORS.text }}>{r.materialCode}</div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                      </td>
                      <td style={{ padding: "9px 12px", fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap" }}>{r.user}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <Badge color={meta.color}>
                          <meta.icon size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                          {r.action}
                        </Badge>
                      </td>
                      <td style={{ padding: "9px 12px", color: COLORS.text, whiteSpace: "nowrap" }}>{r.field ?? "--"}</td>
                      <td style={{ padding: "9px 12px", color: COLORS.text, whiteSpace: "nowrap" }}>
                        {r.oldValue !== null && r.newValue !== null ? `${r.oldValue} -> ${r.newValue}` : "--"}
                      </td>
                      <td style={{ padding: "9px 12px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{formatDateTime(r.time)}</td>
                      <td style={{ padding: "9px 12px", color: COLORS.textMuted, maxWidth: 260 }}>{r.reason}</td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                      No ledger entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
