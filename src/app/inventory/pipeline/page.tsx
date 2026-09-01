"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, XCircle, SlidersHorizontal, Clock, AlertTriangle, ChevronRight } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { RecommendationModal } from "@/components/inventory/RecommendationModal"
import { Badge, KPIChip, SearchBox, PillSelect } from "@/components/inventory/ui/primitives"
import { COLORS, colorMap, RISK_META, STATUS_COLOR, type ColorTone } from "@/lib/inventory/ui/colors"
import { APPROVAL_CHAIN, APPROVAL_STAGE_LABELS, STATUS_DISPLAY } from "@/lib/inventory/approvals"
import { formatDate, formatDateTime } from "@/lib/inventory/format"
import { requestedDateFor } from "@/lib/inventory/ui/labels"
import { deriveMonthWindow, deriveReferenceNow } from "@/lib/inventory/calc/months"
import type { Recommendation } from "@/lib/inventory/calc/types"

/** Waiting-time thresholds for the health signal. Illustrative demo cutoffs -- a real
 * deployment would take these from an agreed SLA per criticality, not a constant. */
const SLOW_DAYS = 7
const STUCK_DAYS = 14

type Health = "On track" | "Slow" | "Stuck"
const HEALTH_COLOR: Record<Health, ColorTone> = { "On track": "success", Slow: "warning", Stuck: "danger" }

export default function InventoryPipelinePage() {
  const { data, recommendations, loading, error, approvals } = useInventory()
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("All")
  const [trackedId, setTrackedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const window = useMemo(() => deriveMonthWindow(data?.consumptionHistory ?? []), [data])
  const referenceNow = useMemo(() => deriveReferenceNow(window), [window])

  /** Days an in-flight item has been waiting, measured from the submitted date already shown
   * on the Approvals table against the dataset's own reference "today" -- not the browser
   * clock, which would read seconds for anything sent during this session. */
  const daysWaiting = useMemo(() => {
    return (materialId: string) => {
      const submitted = new Date(`${requestedDateFor(materialId, window)}T00:00:00Z`)
      return Math.max(0, Math.round((referenceNow.getTime() - submitted.getTime()) / 86_400_000))
    }
  }, [window, referenceNow])

  const healthOf = (days: number): Health => (days >= STUCK_DAYS ? "Stuck" : days >= SLOW_DAYS ? "Slow" : "On track")

  const stockManaged = useMemo(() => recommendations.filter((r) => !r.notStockManaged), [recommendations])

  // Everything currently mid-chain, bucketed by the stage it is actually waiting on.
  const inFlight = useMemo(
    () => stockManaged.filter((r) => approvals.getEntry(r.materialId).status === "IN_APPROVAL"),
    [stockManaged, approvals],
  )

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { NEEDS_REVIEW: 0, APPROVED: 0, ADJUSTED: 0, REJECTED: 0 }
    const byStage = APPROVAL_CHAIN.map(() => 0)
    for (const r of stockManaged) {
      const e = approvals.getEntry(r.materialId)
      if (e.status === "IN_APPROVAL") byStage[Math.min(e.stageIndex, APPROVAL_CHAIN.length - 1)]++
      else byStatus[e.status]++
    }
    return { byStatus, byStage }
  }, [stockManaged, approvals])

  const stuckCount = useMemo(() => inFlight.filter((r) => healthOf(daysWaiting(r.materialId)) === "Stuck").length, [inFlight, daysWaiting])

  const rows = useMemo(() => {
    return inFlight
      .filter((r) => {
        const e = approvals.getEntry(r.materialId)
        if (stageFilter !== "All" && APPROVAL_CHAIN[e.stageIndex] !== stageFilter) return false
        if (search.trim()) {
          const q = search.trim().toLowerCase()
          if (!r.materialCode.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => daysWaiting(b.materialId) - daysWaiting(a.materialId))
  }, [inFlight, approvals, stageFilter, search, daysWaiting])

  const tracked = trackedId ? (stockManaged.find((r) => r.materialId === trackedId) ?? null) : null
  const detailRow = detailId ? (stockManaged.find((r) => r.materialId === detailId) ?? null) : null

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState />

  const funnel: { key: string; label: string; count: number; color: string }[] = [
    { key: "NEEDS_REVIEW", label: "Not submitted", count: counts.byStatus.NEEDS_REVIEW, color: COLORS.primary },
    ...APPROVAL_CHAIN.map((s, i) => ({
      key: s,
      label: APPROVAL_STAGE_LABELS[s],
      count: counts.byStage[i],
      color: COLORS.warning,
    })),
    { key: "APPROVED", label: "Approved", count: counts.byStatus.APPROVED, color: COLORS.accent },
  ]

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Pipeline</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>Where every recommendation sits right now, and what is not moving</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KPIChip label="In flight" value={inFlight.length} tone="neutral" />
          <KPIChip label="Stuck" value={stuckCount} tone="danger" />
          <KPIChip label="Completed" value={counts.byStatus.APPROVED + counts.byStatus.ADJUSTED + counts.byStatus.REJECTED} tone="neutral" />
        </div>
      </div>

      {/* Stage funnel */}
      <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>Flow through the approval chain</div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6, flexWrap: "wrap" }}>
          {funnel.map((f, i) => {
            const isStage = APPROVAL_CHAIN.includes(f.key as (typeof APPROVAL_CHAIN)[number])
            const active = stageFilter === f.key
            return (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 120px" }}>
                <button
                  onClick={() => isStage && setStageFilter(active ? "All" : f.key)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${active ? f.color : COLORS.border}`,
                    background: active ? colorMap.warning.bg : COLORS.bg,
                    cursor: isStage ? "pointer" : "default",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: f.count > 0 ? f.color : COLORS.textLight }}>{f.count}</div>
                  <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.3 }}>{f.label}</div>
                </button>
                {i < funnel.length - 1 && <ChevronRight size={14} color={COLORS.textLight} style={{ flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>
        {(counts.byStatus.ADJUSTED > 0 || counts.byStatus.REJECTED > 0) && (
          <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
            <span>Left the chain early:</span>
            <span style={{ color: COLORS.purple, fontWeight: 700 }}>{`${counts.byStatus.ADJUSTED} adjusted`}</span>
            <span style={{ color: COLORS.danger, fontWeight: 700 }}>{`${counts.byStatus.REJECTED} rejected`}</span>
          </div>
        )}
      </div>

      {/* Per-item tracker */}
      {tracked && <ItemTracker rec={tracked} entry={approvals.getEntry(tracked.materialId)} days={daysWaiting(tracked.materialId)} onClose={() => setTrackedId(null)} onOpen={() => setDetailId(tracked.materialId)} window={window} />}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Track a material..." maxWidth={300} />
        <PillSelect
          value={stageFilter}
          onChange={setStageFilter}
          options={[{ value: "All", label: "All stages" }, ...APPROVAL_CHAIN.map((s) => ({ value: s, label: APPROVAL_STAGE_LABELS[s] }))]}
        />
      </div>

      {/* In-flight table */}
      <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        {inFlight.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Clock size={20} color={COLORS.textLight} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13.5, color: COLORS.textMuted }}>Nothing is in the approval chain right now -- send a recommendation for approval to see it tracked here.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 820 }}>
              <thead>
                <tr style={{ background: COLORS.tableHeaderBg }}>
                  {["Material", "Risk", "Waiting on", "Progress", "Waiting", "Health", "Submitted"].map((h) => (
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
                {rows.map((r) => {
                  const e = approvals.getEntry(r.materialId)
                  const days = daysWaiting(r.materialId)
                  const health = healthOf(days)
                  const isTracked = r.materialId === trackedId
                  return (
                    <tr
                      key={r.materialId}
                      onClick={() => setTrackedId(isTracked ? null : r.materialId)}
                      style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", background: isTracked ? colorMap.success.bg : "transparent" }}
                    >
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ fontWeight: 700, color: COLORS.text }}>{r.materialCode}</div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <Badge color={RISK_META[r.riskBefore].color}>{r.riskBefore}</Badge>
                      </td>
                      <td style={{ padding: "9px 12px", color: COLORS.text, whiteSpace: "nowrap" }}>{APPROVAL_STAGE_LABELS[APPROVAL_CHAIN[e.stageIndex]]}</td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {APPROVAL_CHAIN.map((s, i) => (
                            <span
                              key={s}
                              title={APPROVAL_STAGE_LABELS[s]}
                              style={{ width: 22, height: 5, borderRadius: 3, background: i < e.stageIndex ? COLORS.accent : i === e.stageIndex ? COLORS.warning : COLORS.chipBg }}
                            />
                          ))}
                          <span style={{ fontSize: 10.5, color: COLORS.textMuted, marginLeft: 4 }}>{`${e.stageIndex}/${APPROVAL_CHAIN.length}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 12px", color: COLORS.text, whiteSpace: "nowrap", fontWeight: 600 }}>{`${days} days`}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <Badge color={HEALTH_COLOR[health]}>
                          {health === "Stuck" ? "Stuck" : health}
                        </Badge>
                      </td>
                      <td style={{ padding: "9px 12px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{formatDate(requestedDateFor(r.materialId, window))}</td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                      No in-flight items match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {inFlight.length > 0 && (
          <div style={{ padding: "8px 14px", borderTop: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.textLight }}>
            {`Waiting time is measured from the submitted date against the dataset's reference date -- "Slow" past ${SLOW_DAYS} days, "Stuck" past ${STUCK_DAYS}. Illustrative thresholds, not an agreed SLA.`}
          </div>
        )}
      </div>

      {detailRow && <RecommendationModal rec={detailRow} mode="review" onClose={() => setDetailId(null)} />}
    </div>
  )
}

/** The "where is my item" view -- one horizontal lane from submission to full approval,
 * reading each node's state from the recorded stage sign-offs. */
function ItemTracker({
  rec,
  entry,
  days,
  window,
  onClose,
  onOpen,
}: {
  rec: Recommendation
  entry: ReturnType<ReturnType<typeof useInventory>["approvals"]["getEntry"]>
  days: number
  window: string[]
  onClose: () => void
  onOpen: () => void
}) {
  const nodes = [
    { label: "Submitted", done: Boolean(entry.sentAt), by: entry.sentBy, at: entry.sentAt, current: false },
    ...APPROVAL_CHAIN.map((s, i) => {
      const signOff = entry.stageApprovals.find((x) => x.stage === s)
      return {
        label: APPROVAL_STAGE_LABELS[s],
        done: Boolean(signOff),
        by: signOff?.by ?? null,
        at: signOff?.at ?? null,
        current: entry.status === "IN_APPROVAL" && i === entry.stageIndex,
      }
    }),
  ]
  const stopped = entry.status === "REJECTED" || entry.status === "ADJUSTED"

  return (
    <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{rec.materialCode}</div>
          <div style={{ fontSize: 11.5, color: COLORS.textMuted }}>{rec.description}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge color={STATUS_COLOR[entry.status]}>{STATUS_DISPLAY[entry.status]}</Badge>
          {entry.status === "IN_APPROVAL" && (
            <span style={{ fontSize: 11.5, color: days >= STUCK_DAYS ? COLORS.danger : COLORS.textMuted, fontWeight: 600 }}>
              {days >= STUCK_DAYS && <AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}
              {`${days} days at this step`}
            </span>
          )}
          <button onClick={onOpen} style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Open details
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {nodes.map((n, i) => (
          <div key={n.label} style={{ display: "flex", alignItems: "flex-start", flex: "1 1 0", minWidth: 116 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: n.done ? COLORS.accent : n.current ? COLORS.warning : COLORS.chipBg,
                  color: n.done || n.current ? "#fff" : COLORS.textMuted,
                }}
              >
                {n.done ? <CheckCircle2 size={14} /> : n.current ? <Clock size={14} /> : i}
              </span>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.text, marginTop: 6, textAlign: "center", lineHeight: 1.25 }}>{n.label}</div>
              <div style={{ fontSize: 10, color: n.current ? COLORS.warning : COLORS.textLight, textAlign: "center", marginTop: 2, lineHeight: 1.3 }}>
                {n.done ? n.by : n.current ? "Waiting here" : "Not reached"}
              </div>
              {n.at && <div style={{ fontSize: 9.5, color: COLORS.textLight, textAlign: "center" }}>{formatDateTime(n.at)}</div>}
            </div>
            {i < nodes.length - 1 && (
              <span style={{ height: 2, flex: "0 0 12px", background: n.done ? COLORS.accent : COLORS.border, marginTop: 12 }} />
            )}
          </div>
        ))}
      </div>

      {stopped && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
          {entry.status === "REJECTED" ? (
            <>
              <XCircle size={12} color={COLORS.danger} style={{ verticalAlign: -2, marginRight: 5 }} />
              {`Rejected by ${entry.decidedBy ?? "--"} -- ${entry.rejectionReason ?? "no reason recorded"}`}
            </>
          ) : (
            <>
              <SlidersHorizontal size={12} color={COLORS.purple} style={{ verticalAlign: -2, marginRight: 5 }} />
              {`Adjusted by ${entry.decidedBy ?? "--"} -- chain stopped, levels changed from the recommendation`}
            </>
          )}
        </div>
      )}

      {entry.status === "NEEDS_REVIEW" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
          {`Not submitted yet -- this item has not entered the approval chain. Submitted dates shown elsewhere derive from the dataset window ending ${window[window.length - 1] ?? "--"}.`}
        </div>
      )}
    </div>
  )
}
