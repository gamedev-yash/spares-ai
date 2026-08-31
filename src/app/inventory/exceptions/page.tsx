"use client"

import { useMemo, useState } from "react"
import { TrendingDown, TrendingUp, Clock, Database, AlertTriangle, Eye, Info, ChevronDown, ChevronUp, RotateCcw, ClipboardList, MoreVertical } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { RecommendationModal } from "@/components/inventory/RecommendationModal"
import { PillSelect, SearchBox, Badge } from "@/components/inventory/ui/primitives"
import { COLORS, colorMap, RISK_META, type ColorTone } from "@/lib/inventory/ui/colors"
import { deriveMonthWindow, deriveReferenceNow } from "@/lib/inventory/calc/months"
import { computeLeadTimeSpikes, computeDemandAnomalies } from "@/lib/inventory/calc/exceptions"
import { formatDate } from "@/lib/inventory/format"
import type { Criticality } from "@/lib/inventory/data/types"

type ExceptionType = "stockout" | "leadtime" | "demand" | "data"
type Risk = "Critical" | "High" | "Medium" | "Low"
type Impact = "High" | "Medium" | "Low"

interface ExceptionRow {
  key: string
  materialId: string
  materialCode: string
  description: string
  circuit: string | null
  plant: string
  criticality: Criticality | null
  type: ExceptionType
  risk: Risk
  issue: string
  detectedOn: string
}

const TYPE_META: Record<ExceptionType, { label: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  stockout: { label: "Stockout risk", icon: TrendingDown },
  demand: { label: "Demand anomaly", icon: TrendingUp },
  leadtime: { label: "Lead-time issue", icon: Clock },
  data: { label: "Data issue", icon: Database },
}

const RISK_CARD_META: Record<Risk, { icon: React.ComponentType<{ size?: number; color?: string }>; desc: string }> = {
  Critical: { icon: AlertTriangle, desc: "Require immediate action" },
  High: { icon: TrendingUp, desc: "Action recommended" },
  Medium: { icon: Eye, desc: "Monitor closely" },
  Low: { icon: Info, desc: "Minor issues" },
}

const IMPACT_TONE: Record<Impact, ColorTone> = { High: "danger", Medium: "warning", Low: "success" }

/** Business impact if this exception isn't addressed -- derived from the material's own
 * criticality classification, a real (if simple) signal, deliberately different from the
 * "Risk" column (which reflects how statistically severe *this specific* exception is). */
function impactFromCriticality(crit: Criticality | null): Impact {
  if (crit === "CRITICAL") return "High"
  if (crit === "HIGH") return "Medium"
  return "Low"
}

function stockoutSeverity(shortfall: number, rop: number): Risk {
  const ratio = rop > 0 ? shortfall / rop : 1
  if (ratio >= 0.6) return "Critical"
  if (ratio >= 0.35) return "High"
  if (ratio >= 0.15) return "Medium"
  return "Low"
}
function leadTimeSeverity(ratio: number): Risk {
  if (ratio >= 2.5) return "Critical"
  if (ratio >= 2.0) return "High"
  return "Medium"
}
function demandSeverity(deviationPct: number): Risk {
  const abs = Math.abs(deviationPct)
  if (abs >= 0.8) return "Critical"
  if (abs >= 0.6) return "High"
  return "Medium"
}
/** LOW confidence means the material's own recommendation is on shaky ground -- that's the
 * "data issue" itself, so its severity maps directly from the confidence grade. */
function dataIssueSeverity(confidence: string): Risk {
  if (confidence === "LOW") return "High"
  if (confidence === "MEDIUM") return "Medium"
  return "Low"
}

interface Filters {
  type: "All" | ExceptionType
  risk: "All" | Risk
  plant: string
  circuit: string
  search: string
}
const emptyFilters: Filters = { type: "All", risk: "All", plant: "All", circuit: "All", search: "" }

export default function ExceptionsPage() {
  const { data, recommendations, loading, error } = useInventory()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [showModelInfo, setShowModelInfo] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const rows = useMemo<ExceptionRow[]>(() => {
    if (!data) return []
    const materialsById = new Map(data.materials.map((m) => [m.id, m]))
    const window = deriveMonthWindow(data.consumptionHistory)
    const now = formatDate(deriveReferenceNow(window).toISOString().slice(0, 10))
    const out: ExceptionRow[] = []

    for (const inv of data.currentInventory) {
      const rec = recommendations.find((r) => r.materialId === inv.material_id)
      if (!rec || rec.notStockManaged) continue
      if (inv.unrestricted_stock < rec.current.recommendedROP) {
        const m = materialsById.get(inv.material_id)
        const shortfall = rec.current.recommendedROP - inv.unrestricted_stock
        out.push({
          key: `stockout-${inv.material_id}`,
          materialId: inv.material_id,
          materialCode: m?.material_code ?? inv.material_id,
          description: m?.description ?? "",
          circuit: rec.circuit,
          plant: inv.plant,
          criticality: rec.criticality,
          type: "stockout",
          risk: stockoutSeverity(shortfall, rec.current.recommendedROP),
          issue: `Stock (${inv.unrestricted_stock}) below recommended ROP (${rec.current.recommendedROP}) -- short by ${shortfall}`,
          detectedOn: now,
        })
      }
    }

    const goodsReceiptByPo = new Map(data.goodsReceipt.map((gr) => [gr.po_number, gr]))
    for (const spike of computeLeadTimeSpikes(data.goodsReceipt)) {
      const m = materialsById.get(spike.materialId)
      out.push({
        key: `leadtime-${spike.poNumber}`,
        materialId: spike.materialId,
        materialCode: m?.material_code ?? spike.materialId,
        description: m?.description ?? "",
        circuit: (m?.circuit as string | undefined) ?? null,
        plant: m?.plant ?? "",
        criticality: m?.criticality ?? null,
        type: "leadtime",
        risk: leadTimeSeverity(spike.ratio),
        issue: `Delivery took ${spike.actualDays.toFixed(0)}d vs a ${spike.meanDays.toFixed(0)}d mean (${spike.ratio.toFixed(1)}x), PO ${spike.poNumber}`,
        detectedOn: formatDate(goodsReceiptByPo.get(spike.poNumber)?.goods_receipt_date ?? spike.goodsReceiptDate),
      })
    }

    for (const anomaly of computeDemandAnomalies(window, data.consumptionHistory)) {
      const m = materialsById.get(anomaly.materialId)
      out.push({
        key: `demand-${anomaly.materialId}`,
        materialId: anomaly.materialId,
        materialCode: m?.material_code ?? anomaly.materialId,
        description: m?.description ?? "",
        circuit: (m?.circuit as string | undefined) ?? null,
        plant: m?.plant ?? "",
        criticality: m?.criticality ?? null,
        type: "demand",
        risk: demandSeverity(anomaly.deviationPct),
        issue: `Last 3mo avg ${anomaly.last3Avg.toFixed(1)} vs 12mo avg ${anomaly.last12Avg.toFixed(1)} (${anomaly.deviationPct > 0 ? "+" : ""}${(anomaly.deviationPct * 100).toFixed(0)}%)`,
        detectedOn: formatDate(window[window.length - 1]),
      })
    }

    // Data issues -- real data-quality gaps the engine already tracks (cold-start
    // materials, lead-time estimates with no real delivery history), not fabricated
    // categories like "duplicate material code suspected".
    for (const rec of recommendations) {
      if (rec.notStockManaged) continue
      const m = materialsById.get(rec.materialId)
      if (rec.isOAR) {
        out.push({
          key: `data-oar-${rec.materialId}`,
          materialId: rec.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          circuit: rec.circuit,
          plant: m?.plant ?? "",
          criticality: rec.criticality,
          type: "data",
          risk: dataIssueSeverity(rec.confidence),
          issue: "Insufficient consumption history for reliable classification (cold-start / OAR)",
          detectedOn: now,
        })
      }
      if (rec.flags.some((f) => f.toLowerCase().includes("fallback"))) {
        out.push({
          key: `data-fallback-${rec.materialId}`,
          materialId: rec.materialId,
          materialCode: rec.materialCode,
          description: rec.description,
          circuit: rec.circuit,
          plant: m?.plant ?? "",
          criticality: rec.criticality,
          type: "data",
          risk: dataIssueSeverity(rec.confidence),
          issue: "Lead time estimated from the material master only -- fewer than 2 real delivery records",
          detectedOn: now,
        })
      }
    }

    return out
  }, [data, recommendations])

  const riskCounts: Record<Risk, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  rows.forEach((r) => (riskCounts[r.risk] += 1))
  const typeCounts: Record<ExceptionType, number> = { stockout: 0, demand: 0, leadtime: 0, data: 0 }
  rows.forEach((r) => (typeCounts[r.type] += 1))

  // Materials with zero exceptions at all -- shown as an informational (non-actionable)
  // count, matching the "No risk" card, not folded into the filterable table below.
  const noRiskCount = useMemo(() => {
    const flagged = new Set(rows.map((r) => r.materialId))
    const stockManagedCount = recommendations.filter((r) => !r.notStockManaged).length
    return Math.max(0, stockManagedCount - flagged.size)
  }, [rows, recommendations])

  const circuits = useMemo(() => Array.from(new Set(rows.map((r) => r.circuit).filter(Boolean) as string[])).sort(), [rows])
  const plants = useMemo(() => Array.from(new Set(rows.map((r) => r.plant).filter(Boolean))).sort(), [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((e) => {
      if (filters.type !== "All" && e.type !== filters.type) return false
      if (filters.risk !== "All" && e.risk !== filters.risk) return false
      if (filters.plant !== "All" && e.plant !== filters.plant) return false
      if (filters.circuit !== "All" && e.circuit !== filters.circuit) return false
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        if (!e.materialCode.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rows, filters])

  const clearAll = () => setFilters(emptyFilters)
  const anyFilterActive = Object.entries(filters).some(([k, v]) => (k === "search" ? v.trim() !== "" : v !== "All"))
  const toggleRisk = (sev: Risk) => setFilters((f) => ({ ...f, risk: f.risk === sev ? "All" : sev }))

  const tabs: { key: "All" | ExceptionType; label: string }[] = [
    { key: "All", label: `All exceptions (${rows.length})` },
    { key: "stockout", label: `Stockout risk (${typeCounts.stockout})` },
    { key: "demand", label: `Demand anomalies (${typeCounts.demand})` },
    { key: "leadtime", label: `Lead-time issues (${typeCounts.leadtime})` },
    { key: "data", label: `Data issues (${typeCounts.data})` },
  ]

  const methodCounts = useMemo(() => {
    const stockManaged = recommendations.filter((r) => !r.notStockManaged)
    return {
      statistical: stockManaged.filter((r) => r.demandClass === "Smooth" || r.demandClass === "Erratic").length,
      sba: stockManaged.filter((r) => r.demandClass === "Intermittent" || r.demandClass === "Lumpy").length,
      oar: stockManaged.filter((r) => r.isOAR).length,
    }
  }, [recommendations])

  const reviewRow = reviewId ? (recommendations.find((r) => r.materialId === reviewId) ?? null) : null

  if (error) return <ErrorState message={error} />
  if (loading || !data) return <LoadingState />

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Exceptions</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>Items that need attention and action</p>
        </div>
        {anyFilterActive && (
          <button
            onClick={clearAll}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Risk summary cards (double as filters) + one informational "no risk" card */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {(["Critical", "High", "Medium", "Low"] as Risk[]).map((sev) => {
          const meta = RISK_CARD_META[sev]
          const tone: ColorTone = RISK_META[sev].color
          const swatch = colorMap[tone]
          const active = filters.risk === sev
          return (
            <button
              key={sev}
              onClick={() => toggleRisk(sev)}
              style={{
                flex: 1,
                minWidth: 140,
                textAlign: "left",
                background: active ? swatch.bg : COLORS.card,
                border: `1px solid ${active ? swatch.solid : COLORS.border}`,
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{sev}</div>
                <span style={{ width: 26, height: 26, borderRadius: 13, background: swatch.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <meta.icon size={13} color={swatch.solid} />
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: swatch.solid, marginTop: 4 }}>{riskCounts[sev]}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{meta.desc}</div>
            </button>
          )
        })}
        <div style={{ flex: 1, minWidth: 140, textAlign: "left", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>No risk</div>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: COLORS.mutedBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ClipboardList size={13} color={COLORS.textMuted} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.textMuted, marginTop: 4 }}>{noRiskCount}</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Informational</div>
        </div>
      </div>

      <SearchBox value={filters.search} onChange={(v) => setFilters((f) => ({ ...f, search: v }))} placeholder="Search material, description, equipment..." maxWidth={380} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <PillSelect
          value={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v as Filters["type"] }))}
          options={[{ value: "All", label: "Exception type" }, ...Object.entries(TYPE_META).map(([k, m]) => ({ value: k, label: m.label }))]}
        />
        <PillSelect
          value={filters.risk}
          onChange={(v) => setFilters((f) => ({ ...f, risk: v as Filters["risk"] }))}
          options={[{ value: "All", label: "Risk level" }, ...(["Critical", "High", "Medium", "Low"] as Risk[]).map((r) => ({ value: r, label: r }))]}
        />
        <PillSelect value={filters.plant} onChange={(v) => setFilters((f) => ({ ...f, plant: v }))} options={[{ value: "All", label: "Plant" }, ...plants.map((p) => ({ value: p, label: p }))]} />
        <PillSelect value={filters.circuit} onChange={(v) => setFilters((f) => ({ ...f, circuit: v }))} options={[{ value: "All", label: "Circuit" }, ...circuits.map((c) => ({ value: c, label: c }))]} />
      </div>

      {/* Type tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const active = filters.type === t.key
          return (
            <button
              key={t.key}
              onClick={() => setFilters((f) => ({ ...f, type: t.key }))}
              style={{
                padding: "9px 4px",
                marginRight: 20,
                border: "none",
                borderBottom: active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                background: "none",
                color: active ? COLORS.accent : COLORS.textMuted,
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden", marginBottom: 22 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: COLORS.tableHeaderBg }}>
                {["Risk level", "Exception type", "Material", "Description", "Circuit", "Issue", "Impact", "Detected on", "Action"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 150).map((e) => {
                const typeMeta = TYPE_META[e.type]
                const riskMeta = RISK_META[e.risk]
                const impact = impactFromCriticality(e.criticality)
                return (
                  <tr key={e.key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: riskMeta.dot, flexShrink: 0 }} />
                        <span style={{ color: COLORS.text }}>{e.risk}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.text }}>
                        <typeMeta.icon size={13} color={COLORS.textMuted} /> {typeMeta.label}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: COLORS.text, whiteSpace: "nowrap" }}>{e.materialCode}</td>
                    <td style={{ padding: "10px 12px", color: COLORS.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.description}>
                      {e.description}
                    </td>
                    <td style={{ padding: "10px 12px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{e.circuit ?? "--"}</td>
                    <td style={{ padding: "10px 12px", color: riskMeta.dot, maxWidth: 260 }}>{e.issue}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge color={IMPACT_TONE[impact]}>{impact}</Badge>
                    </td>
                    <td style={{ padding: "10px 12px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{e.detectedOn}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          onClick={() => setReviewId(e.materialId)}
                          style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${COLORS.accent}`, background: COLORS.card, color: COLORS.accent, fontWeight: 700, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Investigate
                        </button>
                        <button style={{ border: "none", background: "none", color: COLORS.textLight, cursor: "pointer", padding: 4, display: "flex" }} title="More actions (not wired up in this mockup)">
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 28, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                    No exceptions match the current filters.
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

      {/* Model info -- real provenance, no fabricated metrics */}
      <button
        onClick={() => setShowModelInfo(!showModelInfo)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 7,
          padding: "7px 14px",
          color: COLORS.textMuted,
          fontSize: 12.5,
          cursor: "pointer",
          marginBottom: showModelInfo ? 12 : 0,
        }}
      >
        {showModelInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Forecast method breakdown
      </button>
      {showModelInfo && (
        <div>
          <div style={{ fontSize: 11.5, color: COLORS.textLight, marginBottom: 10 }}>For engineering and data science teams</div>
          <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
              <MethodStat label="Statistical (D_avg/sigma_D)" value={methodCounts.statistical} desc="Smooth + Erratic demand classes" />
              <MethodStat label="SBA baseline" value={methodCounts.sba} desc="Intermittent + Lumpy demand classes" />
              <MethodStat label="OAR similarity" value={methodCounts.oar} desc="Cold-start materials with insufficient history" />
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
              Recommendation method: Predictive model (LightGBM) -- not yet trained, SBA baseline shown for Intermittent/Lumpy materials. No
              champion-challenger performance numbers exist yet -- this preview never fabricates model metrics.
            </div>
          </div>
        </div>
      )}

      {reviewRow && <RecommendationModal rec={reviewRow} mode="review" onClose={() => setReviewId(null)} />}
    </div>
  )
}

function MethodStat({ label, value, desc }: { label: string; value: number; desc: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{label}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted }}>{desc}</div>
    </div>
  )
}
