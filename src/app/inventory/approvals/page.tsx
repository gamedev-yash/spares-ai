"use client"

import { useCallback, useMemo, useState } from "react"
import { ClipboardList, CheckCircle2, XCircle } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { RecommendationModal } from "@/components/inventory/RecommendationModal"
import { Badge, KPIChip, PillSelect } from "@/components/inventory/ui/primitives"
import { COLORS, colorMap, CRIT_LABEL, CRIT_COLOR, RISK_META, RISK_ORDER, STATUS_COLOR } from "@/lib/inventory/ui/colors"
import { APPROVAL_CHAIN, APPROVAL_STAGE_LABELS, STATUS_DISPLAY } from "@/lib/inventory/approvals"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/inventory/format"
import { DUE_LABEL, requesterFor, requestedDateFor } from "@/lib/inventory/ui/labels"
import { deriveMonthWindow } from "@/lib/inventory/calc/months"
import type { Recommendation } from "@/lib/inventory/calc/types"

const CIRCUITS = ["Crushing", "Milling", "Pumping", "Filtration"]
const CRITICALITIES = ["CRITICAL", "HIGH", "MEDIUM"]
const TRACK_STATUSES = ["IN_APPROVAL", "APPROVED", "ADJUSTED", "REJECTED"]

export default function ApprovalsPage() {
  const { data, recommendations, loading, error, approvals } = useInventory()
  const [tab, setTab] = useState<"mine" | "team" | "all">("mine")
  const [circuit, setCircuit] = useState("All")
  const [crit, setCrit] = useState("All")
  const [status, setStatus] = useState("All")
  const [sortBy, setSortBy] = useState<"due" | "impact" | "risk">("due")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const priceByMaterial = useMemo(() => new Map((data?.materials ?? []).map((m) => [m.id, m.last_po_price])), [data])
  const window = useMemo(() => deriveMonthWindow(data?.consumptionHistory ?? []), [data])
  const impact = useCallback(
    (r: Recommendation) => (r.current.recommendedROP - r.current.currentROP) * (priceByMaterial.get(r.materialId) ?? 0),
    [priceByMaterial],
  )

  // Everything that has ever been sent for approval -- this is the tracking set. Materials
  // still sitting at NEEDS_REVIEW haven't entered the workflow yet and live on Recommendations.
  const tracked = useMemo(
    () => recommendations.filter((r) => !r.notStockManaged && approvals.getEntry(r.materialId).status !== "NEEDS_REVIEW"),
    [recommendations, approvals],
  )
  // "My queue" is only what still needs a decision.
  const queue = useMemo(() => tracked.filter((r) => approvals.getEntry(r.materialId).status === "IN_APPROVAL"), [tracked, approvals])

  const counts = useMemo(() => {
    const c = { IN_APPROVAL: 0, APPROVED: 0, ADJUSTED: 0, REJECTED: 0 } as Record<string, number>
    for (const r of tracked) c[approvals.getEntry(r.materialId).status]++
    return c
  }, [tracked, approvals])

  const rows = useMemo(() => {
    const base = tab === "all" ? tracked : queue
    let list = base.filter(
      (r) =>
        (circuit === "All" || r.circuit === circuit) &&
        (crit === "All" || r.criticality === crit) &&
        (tab !== "all" || status === "All" || approvals.getEntry(r.materialId).status === status),
    )
    if (sortBy === "impact") list = [...list].sort((a, b) => Math.abs(impact(b)) - Math.abs(impact(a)))
    else list = [...list].sort((a, b) => RISK_ORDER[a.riskBefore] - RISK_ORDER[b.riskBefore])
    return list
  }, [tab, tracked, queue, circuit, crit, status, sortBy, impact, approvals])

  // Resolved against every recommendation rather than just the queue, so an item stays
  // visible in the workflow panel after it's decided and drops out of the queue -- otherwise
  // the approval you just made would vanish before you could see it land.
  const byId = useMemo(() => new Map(recommendations.map((r) => [r.materialId, r])), [recommendations])
  const selected = (selectedId ? byId.get(selectedId) : null) ?? rows[0] ?? null
  const reviewRow = (reviewId ? byId.get(reviewId) : null) ?? null

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState />

  const showStatusColumn = tab === "all"
  const headers = showStatusColumn
    ? ["Material", "Circuit", "Criticality", "Requested by", "Change summary", "Impact", "Status", "Decided by", "Action"]
    : ["Material", "Circuit", "Criticality", "Requested by", "Change summary", "Impact", "Risk", "Due date", "Action"]

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Approvals</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>Review, decide, and track inventory recommendations</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KPIChip label="Pending" value={counts.IN_APPROVAL} tone="warning" />
          <KPIChip label="Approved" value={counts.APPROVED} tone="neutral" />
          <KPIChip label="Adjusted" value={counts.ADJUSTED} tone="neutral" />
          <KPIChip label="Rejected" value={counts.REJECTED} tone="danger" />
        </div>
      </div>

      {/* Tabs + filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { id: "mine" as const, label: `My queue (${counts.IN_APPROVAL})` },
            { id: "team" as const, label: "Team queue" },
            { id: "all" as const, label: `All approvals (${tracked.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 2px 10px",
                fontSize: 13.5,
                fontWeight: 600,
                color: tab === t.id ? COLORS.accent : COLORS.textMuted,
                borderBottom: tab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
          <PillSelect value={circuit} onChange={setCircuit} options={[{ value: "All", label: "All circuits" }, ...CIRCUITS.map((c) => ({ value: c, label: c }))]} />
          <PillSelect value={crit} onChange={setCrit} options={[{ value: "All", label: "All criticalities" }, ...CRITICALITIES.map((c) => ({ value: c, label: CRIT_LABEL[c] }))]} />
          {showStatusColumn && (
            <PillSelect
              value={status}
              onChange={setStatus}
              options={[{ value: "All", label: "All statuses" }, ...TRACK_STATUSES.map((s) => ({ value: s, label: STATUS_DISPLAY[s] }))]}
            />
          )}
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Sort by</span>
          <PillSelect
            value={sortBy}
            onChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: "due", label: "Due date" },
              { value: "impact", label: "Inventory impact" },
              { value: "risk", label: "Risk level" },
            ]}
          />
        </div>
      </div>

      {tab === "team" ? (
        <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 40, textAlign: "center" }}>
          <ClipboardList size={20} color={COLORS.textLight} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13.5, color: COLORS.textMuted }}>
            Team queue would need per-user role assignment, which this mockup doesn&apos;t model -- every recommendation currently routes through the same session-local chain.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%" }}>
          <div style={{ flex: 1, minWidth: 0, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 880 }}>
                <thead>
                  <tr style={{ background: COLORS.tableHeaderBg }}>
                    {headers.map((h) => (
                      <th
                        key={h}
                        style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: COLORS.textMuted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${COLORS.border}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isSelected = r.materialId === (selected?.materialId ?? "")
                    const rImpact = impact(r)
                    const due = DUE_LABEL[r.riskBefore]
                    const entry = approvals.getEntry(r.materialId)
                    const isPending = entry.status === "IN_APPROVAL"
                    return (
                      <tr
                        key={r.materialId}
                        onClick={() => setSelectedId(r.materialId)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, background: isSelected ? colorMap.success.bg : "transparent", cursor: "pointer" }}
                      >
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 700, color: COLORS.text }}>{r.materialCode}</div>
                          <div style={{ fontSize: 10.5, color: COLORS.textMuted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                        </td>
                        <td style={{ padding: "8px 10px", color: COLORS.text, whiteSpace: "nowrap" }}>{r.circuit}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <Badge color={CRIT_COLOR[r.criticality]}>{CRIT_LABEL[r.criticality].split(" -- ")[0]}</Badge>
                        </td>
                        <td style={{ padding: "8px 10px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>
                          {(() => {
                            const requester = requesterFor(r.materialId, r.plant, data?.users ?? [])
                            return (
                              <>
                                <div style={{ fontWeight: 600, color: COLORS.text }}>{entry.sentBy ?? requester?.name ?? "System"}</div>
                                <div style={{ fontSize: 10, color: COLORS.textLight }}>{formatDate(requestedDateFor(r.materialId, window))}</div>
                              </>
                            )
                          })()}
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 10.5, color: COLORS.textMuted, lineHeight: 1.5 }}>
                          <div>
                            SS {r.current.currentSafetyStock} -&gt; {r.current.recommendedSafetyStock}
                          </div>
                          <div>
                            ROP {r.current.currentROP} -&gt; {r.current.recommendedROP}
                          </div>
                          <div>
                            Max {r.current.currentMaxStock} -&gt; {r.current.recommendedMaxStockOptionA}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: rImpact < 0 ? COLORS.accent : COLORS.coral, whiteSpace: "nowrap" }}>
                          {rImpact < 0 ? "-" : "+"}
                          {formatCurrency(Math.abs(rImpact))}
                        </td>

                        {showStatusColumn ? (
                          <>
                            <td style={{ padding: "8px 10px" }}>
                              <Badge color={STATUS_COLOR[entry.status]}>{STATUS_DISPLAY[entry.status]}</Badge>
                            </td>
                            <td style={{ padding: "8px 10px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>
                              {entry.decidedBy ? (
                                <>
                                  <div style={{ fontWeight: 600, color: COLORS.text }}>{entry.decidedBy}</div>
                                  {entry.decidedAt && <div style={{ fontSize: 10, color: COLORS.textLight }}>{formatDateTime(entry.decidedAt)}</div>}
                                </>
                              ) : (
                                "--"
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "8px 10px" }}>
                              <Badge color={RISK_META[r.riskBefore].color}>{r.riskBefore}</Badge>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: due.tone === "coral" ? COLORS.coral : COLORS.text }}>{due.label}</span>
                            </td>
                          </>
                        )}

                        <td style={{ padding: "8px 10px" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(r.materialId)
                              setReviewId(r.materialId)
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: isPending ? "none" : `1px solid ${COLORS.border}`,
                              background: isPending ? COLORS.accent : COLORS.card,
                              color: isPending ? "#fff" : COLORS.textMuted,
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {isPending ? "Review" : "View"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={headers.length} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                        {tab === "all" ? "Nothing has been sent for approval yet." : "No approvals match the current filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approval workflow panel */}
          <div style={{ width: 240, flexShrink: 0, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>Approval workflow</div>
            {!selected ? (
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 10 }}>Nothing selected -- your queue is clear.</div>
            ) : (
              (() => {
                const entry = approvals.getEntry(selected.materialId)
                const decided = entry.status === "APPROVED" || entry.status === "ADJUSTED" || entry.status === "REJECTED"
                return (
                  <>
                    <div style={{ fontSize: 11.5, color: COLORS.textLight, marginBottom: 12 }}>
                      {selected.materialCode} -- {selected.description}
                    </div>

                    {APPROVAL_CHAIN.map((stage, i) => {
                      // Every stage's state comes from what actually happened: a recorded
                      // sign-off in stageApprovals, the stage currently pending, or nothing yet.
                      // Reaching APPROVED never back-fills stages nobody signed.
                      const signOff = entry.stageApprovals.find((s) => s.stage === stage)
                      const rejectedHere = entry.status === "REJECTED" && i === entry.stageIndex
                      const adjustedHere = entry.status === "ADJUSTED" && i === entry.stageIndex
                      const pendingHere = entry.status === "IN_APPROVAL" && i === entry.stageIndex
                      const done = Boolean(signOff)

                      let label: string
                      let tone: string
                      if (signOff) {
                        label = "Approved"
                        tone = COLORS.accent
                      } else if (rejectedHere) {
                        label = "Rejected -- chain stopped"
                        tone = COLORS.danger
                      } else if (adjustedHere) {
                        label = "Adjusted -- chain stopped"
                        tone = COLORS.purple
                      } else if (pendingHere) {
                        label = "Pending"
                        tone = COLORS.warning
                      } else {
                        label = "Not yet reached"
                        tone = COLORS.textMuted
                      }
                      return (
                        <div key={stage} style={{ display: "flex", gap: 10, position: "relative" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                background: done ? tone : rejectedHere ? COLORS.danger : COLORS.chipBg,
                                color: done || rejectedHere ? "#fff" : COLORS.textMuted,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {done ? <CheckCircle2 size={13} /> : rejectedHere ? <XCircle size={13} /> : i + 1}
                            </span>
                            {i < APPROVAL_CHAIN.length - 1 && <span style={{ width: 1, flex: 1, background: COLORS.border, marginTop: 2, marginBottom: 2, minHeight: 24 }} />}
                          </div>
                          <div style={{ paddingBottom: 18 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{APPROVAL_STAGE_LABELS[stage]}</div>
                            <div style={{ fontSize: 11, color: tone, marginTop: 1 }}>{label}</div>
                            {signOff && (
                              <>
                                <div style={{ fontSize: 11, color: COLORS.text, fontWeight: 600, marginTop: 2 }}>{signOff.by}</div>
                                <div style={{ fontSize: 10, color: COLORS.textLight }}>{formatDateTime(signOff.at)}</div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {decided && (
                      <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, marginBottom: 12 }}>
                        <Badge color={STATUS_COLOR[entry.status]}>{STATUS_DISPLAY[entry.status]}</Badge>
                        {entry.decidedBy && (
                          <div style={{ fontSize: 11.5, color: COLORS.text, marginTop: 6, fontWeight: 600 }}>{entry.decidedBy}</div>
                        )}
                        {entry.decidedAt && <div style={{ fontSize: 10.5, color: COLORS.textLight }}>{formatDateTime(entry.decidedAt)}</div>}
                        {entry.rejectionReason && (
                          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.45 }}>Reason: {entry.rejectionReason}</div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setReviewId(selected.materialId)}
                      style={{
                        width: "100%",
                        padding: "8px 0",
                        borderRadius: 6,
                        border: `1px solid ${decided ? COLORS.border : COLORS.accent}`,
                        background: COLORS.card,
                        color: decided ? COLORS.textMuted : COLORS.accent,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {decided ? "View details" : "Review this item"}
                    </button>
                  </>
                )
              })()
            )}
          </div>
        </div>
      )}

      {reviewRow && <RecommendationModal rec={reviewRow} mode="decide" onClose={() => setReviewId(null)} />}
    </div>
  )
}
