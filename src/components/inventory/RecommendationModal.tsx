"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  X,
  ShieldCheck,
  ShoppingCart,
  Package,
  MessageSquare,
  Gauge,
  BarChart3,
  Shield,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  XCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Send,
  History,
  ExternalLink,
} from "lucide-react"

import type { Recommendation } from "@/lib/inventory/calc/types"
import { useInventory } from "@/lib/inventory/context"
import { APPROVAL_CHAIN, APPROVAL_STAGE_LABELS, ADJUSTABLE_FIELD_LABELS, STATUS_DISPLAY, type AdjustableField, type ApprovalEntry, type ApprovalStatus } from "@/lib/inventory/approvals"
import { formatCurrency, formatDate } from "@/lib/inventory/format"
import { COLORS, colorMap, CRIT_LABEL, CONF_COLOR, CONF_PCT, RISK_META, STATUS_COLOR } from "@/lib/inventory/ui/colors"
import { requesterFor, deciderFor } from "@/lib/inventory/ui/labels"
import { Badge, Chip, SectionTitle } from "@/components/inventory/ui/primitives"
import { AdjustModal } from "@/components/inventory/AdjustModal"

const DATA_QUALITY_LABEL: Record<string, string> = { HIGH: "Good", MEDIUM: "Fair", LOW: "Limited", NotApplicable: "N/A" }

/**
 * The single recommendation detail modal, shared by every screen that opens one (Overview,
 * Recommendations, Exceptions "Investigate", Approvals) -- reasons/confidence/risk/SS-ROP-Max
 * content is identical everywhere; only the action row at the bottom differs by `mode`:
 *   "review" (Recommendations/Exceptions/Overview) -- understand it, then Send for Approval.
 *   "decide"  (Approvals)                          -- Approve / Adjust / Reject.
 */
export function RecommendationModal({ rec, mode, onClose }: { rec: Recommendation; mode: "review" | "decide"; onClose: () => void }) {
  const [showTechnical, setShowTechnical] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showRejectReason, setShowRejectReason] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const router = useRouter()
  const { approvals, data } = useInventory()
  const entry = approvals.getEntry(rec.materialId)

  const increasing = rec.current.recommendedROP > rec.current.currentROP
  const currentStageLabel = APPROVAL_STAGE_LABELS[APPROVAL_CHAIN[entry.stageIndex]]
  const decider = deciderFor(rec.materialId, rec.plant, data?.users ?? [])
  const deciderName = decider?.name ?? currentStageLabel

  const itemLabel = `${rec.materialCode} -- ${rec.description}`

  const sendForApproval = () => {
    const requester = requesterFor(rec.materialId, rec.plant, data?.users ?? [])
    approvals.sendForApproval(rec.materialId, requester?.name ?? "You")
    toast.info(`Sent for approval -- ${itemLabel}`)
  }
  const approve = () => {
    approvals.approve(rec.materialId, deciderName)
    toast.success(`Approved -- ${itemLabel}`)
    // Decide-mode only (Approvals page) -- closing returns the user to the queue, which has
    // already reactively dropped this item and moved the "Approval workflow" panel on to the
    // next one, so there's nothing left to see behind the modal once this item is decided.
    if (mode === "decide") onClose()
  }
  const submitAdjust = (changes: { field: AdjustableField; recommended: number; adjusted: number }[], reason: string) => {
    approvals.adjust(rec.materialId, changes, reason, deciderName)
    toast.warning(`Adjusted -- ${itemLabel}`)
    setShowAdjustModal(false)
    if (mode === "decide") onClose()
  }
  const submitReject = () => {
    if (!rejectReason.trim()) return
    approvals.reject(rec.materialId, rejectReason.trim(), deciderName)
    toast.error(`Rejected -- ${itemLabel}`)
    setShowRejectReason(false)
    if (mode === "decide") onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.overlay,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1040,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          background: COLORS.card,
          borderRadius: 16,
          boxShadow: `0 24px 64px ${COLORS.shadow}`,
          padding: "28px 32px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.text }}>{rec.materialCode}</span>
            {!rec.notStockManaged && <Badge color={RISK_META[rec.riskBefore].color}>{rec.riskBefore} risk</Badge>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.textMuted, padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 16 }}>{rec.description}</div>

        {rec.notStockManaged ? (
          <div style={{ padding: "16px 0", fontSize: 13.5, color: COLORS.textMuted }}>
            This is a contracted service line, not a physical spare -- it is not inventory-managed and has no SS/ROP/Max recommendation.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
              <Chip>Category: {CRIT_LABEL[rec.criticality]}</Chip>
              <Chip highlighted>Demand pattern: {rec.demandClass}</Chip>
              {rec.zFactor !== null && <Chip>Z-factor: {rec.zFactor.toFixed(2)} (illustrative)</Chip>}
            </div>

            {rec.isOAR && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: colorMap.warning.bg, borderRadius: 10, padding: 16, marginBottom: 26 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    background: colorMap.warning.solid,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={16} color="#fff" />
                </span>
                <div style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>OAR / cold-start material</div>
                  {`No reliable consumption history -- this recommendation is derived from ${rec.oarNeighbors.length} comparable material(s), not this material's own demand data.`}
                  {rec.oarNeighbors.length > 0 && (
                    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                      {rec.oarNeighbors.map((n) => (
                        <li key={n.materialId} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: COLORS.textMuted, padding: "2px 0" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {n.materialCode} -- {n.description}
                          </span>
                          <span style={{ flexShrink: 0 }}>{(n.combinedSimilarity * 100).toFixed(0)}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Recommended inventory */}
            <SectionTitle icon={ShieldCheck}>Recommended inventory</SectionTitle>
            <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
              {[
                { l: "Safety Stock", icon: ShieldCheck, colorKey: "success" as const, c: rec.current.currentSafetyStock, r: rec.current.recommendedSafetyStock },
                { l: "Reorder Point", icon: ShoppingCart, colorKey: "primary" as const, c: rec.current.currentROP, r: rec.current.recommendedROP },
                { l: "Max Stock (EOQ)", icon: Package, colorKey: "purple" as const, c: rec.current.currentMaxStock, r: rec.current.recommendedMaxStockOptionA },
                { l: "Max Stock (Review period)", icon: Package, colorKey: "purple" as const, c: rec.current.currentMaxStock, r: rec.current.recommendedMaxStockOptionB },
              ].map((m) => {
                const change = m.r - m.c
                const accent = colorMap[m.colorKey].solid
                return (
                  <div key={m.l} style={{ flex: "1 1 130px", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: colorMap[m.colorKey].bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <m.icon size={13} color={accent} />
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.text }}>{m.l}</span>
                    </div>
                    <div style={{ fontSize: 23, fontWeight: 800, color: accent, marginBottom: 8 }}>{m.r}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: COLORS.text }}>{m.c}</div>
                        <div style={{ color: COLORS.textLight, fontSize: 10 }}>Current</div>
                      </div>
                      <ArrowRight size={12} color={COLORS.textLight} />
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: change < 0 ? COLORS.accent : change > 0 ? COLORS.coral : COLORS.textMuted }}>
                          {change > 0 ? `+${change}` : change}
                        </div>
                        <div style={{ color: COLORS.textLight, fontSize: 10 }}>Change</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Why this recommendation */}
            <SectionTitle icon={MessageSquare}>Why this recommendation?</SectionTitle>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                background: increasing ? colorMap.coral.bg : colorMap.success.bg,
                borderRadius: 10,
                padding: 16,
                marginBottom: 26,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: increasing ? COLORS.coral : COLORS.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {increasing ? <AlertTriangle size={16} color="#fff" /> : <CheckCircle2 size={16} color="#fff" />}
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {rec.reasons.map((reason, i) => (
                  <li key={i} style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5 }}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk */}
            <SectionTitle icon={Gauge}>Risk level</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
              <div style={{ flex: 1, textAlign: "center", padding: "16px 12px", borderRadius: 10, background: colorMap[RISK_META[rec.riskBefore].color].bg }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>Current</div>
                <Badge color={RISK_META[rec.riskBefore].color}>{rec.riskBefore} risk</Badge>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                  ROP {rec.current.currentROP} of {rec.current.recommendedROP} recommended
                </div>
              </div>
              <ArrowRight size={18} color={COLORS.textLight} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: "center", padding: "16px 12px", borderRadius: 10, background: colorMap.success.bg }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>If approved</div>
                <Badge color="success">{rec.riskAfter} risk</Badge>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>ROP set to the recommended level</div>
              </div>
            </div>

            {/* Confidence + data quality */}
            <div style={{ display: "flex", gap: 24, marginBottom: 26, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <SectionTitle icon={BarChart3}>Recommendation confidence</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 8, background: COLORS.mutedBg, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${CONF_PCT[rec.confidence]}%`, background: colorMap[CONF_COLOR[rec.confidence]].solid, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colorMap[CONF_COLOR[rec.confidence]].solid, whiteSpace: "nowrap" }}>{rec.confidence}</span>
                </div>
              </div>
              <div style={{ width: 1, background: COLORS.border }} />
              <div style={{ flex: "1 1 160px" }}>
                <SectionTitle icon={Shield}>Data quality</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: colorMap[CONF_COLOR[rec.confidence]].solid }}>{DATA_QUALITY_LABEL[rec.confidence]}</span>
                  <Info size={13} color={COLORS.textLight} />
                </div>
              </div>
            </div>

            {/* Impact summary */}
            <SectionTitle icon={Info}>Impact summary</SectionTitle>
            <ImpactSummary rec={rec} showAnnualEstimate={mode === "decide"} />

            {rec.upcomingMaintenance.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: colorMap.primary.bg, borderRadius: 10, padding: 16, marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.primary }}>
                  <CalendarClock size={14} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Known future commitment (not part of the statistical SS/ROP)
                  </span>
                </div>
                {rec.upcomingMaintenance.map((m) => (
                  <div key={m.workOrder} style={{ fontSize: 13, color: COLORS.text }}>
                    Requires <strong>{m.requiredQty} units</strong> on {formatDate(m.plannedDate)} ({m.maintenanceType}, {m.workOrder})
                  </div>
                ))}
              </div>
            )}

            {rec.flags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
                {rec.flags.map((flag) => (
                  <Badge key={flag} color="warning">
                    {flag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Actions -- mode-dependent */}
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
              {mode === "review" ? "Review" : "Decision"}
            </div>

            {mode === "review" ? (
              <ReviewActions status={entry.status} stageLabel={currentStageLabel} onSend={sendForApproval} onViewInApprovals={() => router.push("/inventory/approvals")} />
            ) : entry.status !== "IN_APPROVAL" ? (
              <div style={{ marginBottom: 18 }}>
                <Badge color={STATUS_COLOR[entry.status]}>{STATUS_DISPLAY[entry.status]}</Badge>
              </div>
            ) : showRejectReason ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 5 }}>Reason for rejection (required)</div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Budget constraints this quarter"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={submitReject}
                    disabled={!rejectReason.trim()}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: COLORS.coral,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: rejectReason.trim() ? "pointer" : "default",
                      opacity: rejectReason.trim() ? 1 : 0.45,
                    }}
                  >
                    Confirm reject
                  </button>
                  <button onClick={() => setShowRejectReason(false)} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 12.5, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 10 }}>Awaiting {currentStageLabel}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  <button onClick={approve} style={actionBtnStyle(COLORS.accent, "#fff", false)}>
                    <CheckCircle2 size={15} /> Approve
                  </button>
                  <button onClick={() => setShowAdjustModal(true)} style={actionBtnStyle(COLORS.card, COLORS.warning, false, COLORS.warning)}>
                    <SlidersHorizontal size={15} /> Adjust
                  </button>
                  <button onClick={() => setShowRejectReason(true)} style={actionBtnStyle(COLORS.card, COLORS.coral, false, COLORS.coral)}>
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              </>
            )}

            {/* Audit trail -- shown in both modes wherever this material has decision history */}
            <AuditTrail entry={entry} />
          </>
        )}

        {/* Technical details */}
        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
          <button
            onClick={() => setShowTechnical((s) => !s)}
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              padding: 0,
            }}
          >
            Technical details
            {showTechnical ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTechnical && (
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: COLORS.textLight }}>
                    <th style={{ padding: "4px 8px 4px 0", fontWeight: 600 }}>Step</th>
                    <th style={{ padding: "4px 8px", fontWeight: 600 }}>Formula</th>
                    <th style={{ padding: "4px 8px", fontWeight: 600 }}>Inputs</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.trace.map((t, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}`, verticalAlign: "top" }}>
                      <td style={{ padding: "6px 8px 6px 0", fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap" }}>
                        {t.step}. {t.label}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", color: COLORS.textMuted }}>{t.formula ?? "--"}</td>
                      <td style={{ padding: "6px 8px", color: COLORS.textMuted }}>
                        {t.inputs
                          ? Object.entries(t.inputs)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(", ")
                          : "--"}
                      </td>
                      <td style={{ padding: "6px 0", color: COLORS.text }}>
                        {t.result ?? "--"}
                        {t.note && <div style={{ color: COLORS.textLight, fontStyle: "italic", marginTop: 2 }}>{t.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdjustModal && <AdjustModal rec={rec} onCancel={() => setShowAdjustModal(false)} onSubmit={submitAdjust} />}
    </div>
  )
}

function ReviewActions({
  status,
  stageLabel,
  onSend,
  onViewInApprovals,
}: {
  status: ApprovalStatus
  stageLabel: string
  onSend: () => void
  onViewInApprovals: () => void
}) {
  if (status === "NEEDS_REVIEW") {
    return (
      <button onClick={onSend} style={{ ...actionBtnStyle(COLORS.accent, "#fff", false), width: "100%", marginBottom: 18 }}>
        <Send size={15} /> Send for Approval
      </button>
    )
  }
  if (status === "IN_APPROVAL") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18, padding: "10px 14px", borderRadius: 8, background: colorMap.warning.bg }}>
        <div>
          <Badge color="warning">Pending approval</Badge>
          <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 4 }}>Awaiting {stageLabel}</div>
        </div>
        <button
          onClick={onViewInApprovals}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: COLORS.primary, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          View in Approvals <ExternalLink size={12} />
        </button>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <Badge color={STATUS_COLOR[status]}>{STATUS_DISPLAY[status]}</Badge>
    </div>
  )
}

function AuditTrail({ entry }: { entry: ApprovalEntry }) {
  const lines: { text: string; at: string }[] = []
  if (entry.sentAt && entry.sentBy) lines.push({ text: `${entry.sentBy} sent this for approval`, at: entry.sentAt })
  for (const a of entry.adjustments) {
    lines.push({ text: `AI recommended ${a.recommended} -> ${a.by} changed ${ADJUSTABLE_FIELD_LABELS[a.field]} to ${a.adjusted} -- Reason: ${a.reason}`, at: a.at })
  }
  if (entry.status === "REJECTED" && entry.decidedBy) {
    lines.push({ text: `${entry.decidedBy} rejected this recommendation -- Reason: ${entry.rejectionReason ?? "--"}`, at: entry.decidedAt ?? entry.sentAt ?? "" })
  }
  if (entry.status === "APPROVED" && entry.decidedBy) {
    lines.push({ text: `${entry.decidedBy} approved this recommendation`, at: entry.decidedAt ?? entry.sentAt ?? "" })
  }
  if (lines.length === 0) return null

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionTitle icon={History}>Decision history</SectionTitle>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((l, i) => (
          <li key={i} style={{ fontSize: 12.5, color: COLORS.text, borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 10 }}>
            {l.text}
            {l.at && <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 1 }}>{formatDate(l.at.slice(0, 10))}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function actionBtnStyle(bg: string, color: string, disabled: boolean, borderColor?: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "11px 0",
    borderRadius: 8,
    border: borderColor ? `1px solid ${borderColor}` : "none",
    background: bg,
    color,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontSize: 13.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  }
}

function ImpactSummary({ rec, showAnnualEstimate }: { rec: Recommendation; showAnnualEstimate: boolean }) {
  // Real inventory-value delta (recommended ROP - current ROP) x unit price -- not a
  // fabricated stat, just the two real numbers already shown above, multiplied by price.
  const { data } = useInventory()
  const material = data?.materials.find((m) => m.id === rec.materialId)
  const price = material?.last_po_price ?? 0
  const deltaValue = (rec.current.recommendedROP - rec.current.currentROP) * price
  const isSaving = deltaValue < 0

  // Simple estimate requested for the Approvals decision view: (recommended - current
  // Safety Stock) x unit price, labeled clearly as an estimate -- not the same figure as
  // the ROP-based tile above, which reflects reorder-point value, not a standing investment.
  const ssDelta = (rec.current.recommendedSafetyStock - rec.current.currentSafetyStock) * price

  return (
    <>
      <div style={{ display: "flex", background: COLORS.impactBg, borderRadius: 10, padding: 16, marginBottom: showAnnualEstimate ? 12 : 26, flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginBottom: 4 }}>Inventory value impact (at ROP)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: isSaving ? COLORS.accent : COLORS.coral }}>
            {isSaving ? "-" : "+"}
            {formatCurrency(Math.abs(deltaValue))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{isSaving ? "Lower committed stock value" : "Higher committed stock value"}</div>
        </div>
        <div style={{ width: 1, background: COLORS.border }} />
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginBottom: 4 }}>Service level policy</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.warning }}>{rec.policyStatus ?? "Not found"}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>No approved target yet -- see Policies</div>
        </div>
      </div>
      {showAnnualEstimate && (
        <div style={{ borderRadius: 10, border: `1px dashed ${COLORS.border}`, padding: "10px 14px", marginBottom: 26, fontSize: 12, color: COLORS.textMuted }}>
          <span style={{ fontWeight: 700, color: ssDelta < 0 ? COLORS.accent : COLORS.coral }}>
            {ssDelta < 0 ? "-" : "+"}
            {formatCurrency(Math.abs(ssDelta))}
          </span>{" "}
          estimated annual investment impact -- (recommended - current Safety Stock) x unit price. A simple estimate, not a formal budget figure.
        </div>
      )}
    </>
  )
}
