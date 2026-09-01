"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { RecommendationModal } from "@/components/inventory/RecommendationModal"
import { Badge, KPIChip, PillSelect, SearchBox, ClearFiltersButton } from "@/components/inventory/ui/primitives"
import { COLORS, CRIT_LABEL, RISK_META, STATUS_COLOR } from "@/lib/inventory/ui/colors"
import { STATUS_DISPLAY, type ApprovalStatus } from "@/lib/inventory/approvals"
import type { Recommendation } from "@/lib/inventory/calc/types"

const CIRCUITS = ["Crushing", "Milling", "Pumping", "Filtration"]
const CRITICALITIES = ["CRITICAL", "HIGH", "MEDIUM"]
const DEMAND_PATTERNS = ["Smooth", "Erratic", "Intermittent", "Lumpy", "OAR"]
const RISK_LEVELS = ["Critical", "High", "Medium", "Low"]
// Only the two "still needs action" states -- anything decided has left this page for the
// Reports ledger, so offering Approved/Adjusted/Rejected here would filter to nothing.
const STATUSES: ApprovalStatus[] = ["NEEDS_REVIEW", "IN_APPROVAL"]
const DECIDED: ApprovalStatus[] = ["APPROVED", "ADJUSTED", "REJECTED"]

interface Filters {
  circuit: string
  crit: string
  demand: string
  risk: string
  status: string
  search: string
}
const emptyFilters: Filters = { circuit: "All", crit: "All", demand: "All", risk: "All", status: "All", search: "" }

function recommendationLabel(r: Recommendation): string {
  const cur = r.current.currentROP
  const rec = r.current.recommendedROP
  if (rec === cur) return "Maintain levels"
  if (rec > cur) return r.riskBefore === "Critical" ? "Increase protection" : "Increase stock"
  return "Reduce stock"
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecommendationsContent />
    </Suspense>
  )
}

function RecommendationsContent() {
  const params = useSearchParams()
  const { recommendations, loading, error, approvals } = useInventory()
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, circuit: params.get("circuit") ?? "All", demand: params.get("demand") ?? "All" })

  // Derived-during-render sync (not an effect+setState) so navigating here again with a
  // different ?focus= re-opens the modal even though the page instance doesn't remount.
  const focusParam = params.get("focus")
  const [reviewState, setReviewState] = useState({ focusParam, reviewId: focusParam })
  if (reviewState.focusParam !== focusParam) {
    setReviewState({ focusParam, reviewId: focusParam })
  }
  const reviewId = reviewState.reviewId
  const setReviewId = (id: string | null) => setReviewState((s) => ({ ...s, reviewId: id }))

  // Decided items (approved/adjusted/rejected) drop off this page -- the work is done and the
  // permanent record lives on Reports. What's left is what still needs someone to act.
  const rows = useMemo(
    () => recommendations.filter((r) => !r.notStockManaged && !DECIDED.includes(approvals.getEntry(r.materialId).status)),
    [recommendations, approvals],
  )
  const decidedCount = useMemo(
    () => recommendations.filter((r) => !r.notStockManaged && DECIDED.includes(approvals.getEntry(r.materialId).status)).length,
    [recommendations, approvals],
  )

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filters.circuit !== "All" && r.circuit !== filters.circuit) return false
      if (filters.crit !== "All" && r.criticality !== filters.crit) return false
      if (filters.demand !== "All" && r.demandClass !== filters.demand) return false
      if (filters.risk !== "All" && r.riskBefore !== filters.risk) return false
      if (filters.status !== "All" && approvals.getEntry(r.materialId).status !== filters.status) return false
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        if (!r.materialCode.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, filters, approvals])

  const totalCount = rows.length
  const needReviewCount = rows.filter((r) => approvals.getEntry(r.materialId).status === "NEEDS_REVIEW").length
  const inApprovalCount = rows.filter((r) => approvals.getEntry(r.materialId).status === "IN_APPROVAL").length

  const reviewRow = rows.find((r) => r.materialId === reviewId) || null
  const clearAll = () => setFilters(emptyFilters)
  const anyFilterActive = Object.entries(filters).some(([k, v]) => (k === "search" ? v.trim() !== "" : v !== "All"))

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingState />

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Recommendations</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            {decidedCount > 0
              ? `Still open -- ${decidedCount} decided item(s) moved to Reports`
              : "Review what the system recommends for each material"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KPIChip label="Open" value={totalCount} tone="neutral" />
          <KPIChip label="Need review" value={needReviewCount} tone="warning" />
          <KPIChip label="In review" value={inApprovalCount} tone="neutral" />
        </div>
      </div>

      <SearchBox value={filters.search} onChange={(v) => setFilters((f) => ({ ...f, search: v }))} placeholder="Search material..." maxWidth={340} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <PillSelect
          value={filters.circuit}
          onChange={(v) => setFilters((f) => ({ ...f, circuit: v }))}
          options={[{ value: "All", label: "All circuits" }, ...CIRCUITS.map((c) => ({ value: c, label: c }))]}
        />
        <PillSelect
          value={filters.crit}
          onChange={(v) => setFilters((f) => ({ ...f, crit: v }))}
          options={[{ value: "All", label: "All criticalities" }, ...CRITICALITIES.map((c) => ({ value: c, label: CRIT_LABEL[c] }))]}
        />
        <PillSelect
          value={filters.demand}
          onChange={(v) => setFilters((f) => ({ ...f, demand: v }))}
          options={[{ value: "All", label: "All demand patterns" }, ...DEMAND_PATTERNS.map((d) => ({ value: d, label: d }))]}
        />
        <PillSelect
          value={filters.risk}
          onChange={(v) => setFilters((f) => ({ ...f, risk: v }))}
          options={[{ value: "All", label: "All risk levels" }, ...RISK_LEVELS.map((r) => ({ value: r, label: r }))]}
        />
        <PillSelect
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[{ value: "All", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_DISPLAY[s] }))]}
        />
        {anyFilterActive && <ClearFiltersButton onClick={clearAll} />}
      </div>

      <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr style={{ background: COLORS.tableHeaderBg }}>
                {["Material", "Circuit", "Recommendation", "Risk", "Status", "Action"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: COLORS.textMuted,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 150).map((r) => (
                <tr key={r.materialId} onClick={() => setReviewId(r.materialId)} style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ fontWeight: 700, color: COLORS.text }}>{r.materialCode}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                  </td>
                  <td style={{ padding: "9px 12px", color: COLORS.text }}>{r.circuit}</td>
                  <td style={{ padding: "9px 12px", color: COLORS.text }}>{recommendationLabel(r)}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge color={RISK_META[r.riskBefore].color}>{r.riskBefore}</Badge>
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Badge color={STATUS_COLOR[approvals.getEntry(r.materialId).status]}>{STATUS_DISPLAY[approvals.getEntry(r.materialId).status]}</Badge>
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setReviewId(r.materialId)
                      }}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                    No recommendations match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 150 && (
          <div style={{ padding: "8px 16px", fontSize: 11.5, color: COLORS.textLight, borderTop: `1px solid ${COLORS.border}` }}>
            Showing first 150 of {filteredRows.length} -- narrow the filters to see more.
          </div>
        )}
      </div>

      {reviewRow && <RecommendationModal rec={reviewRow} mode="review" onClose={() => setReviewId(null)} />}
    </div>
  )
}
