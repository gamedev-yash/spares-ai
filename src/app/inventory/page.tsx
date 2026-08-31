"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChevronUp, ChevronDown, RotateCcw, Search } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { KPICard, Select, Panel, Badge } from "@/components/inventory/ui/primitives"
import { formatCurrencyCompact } from "@/lib/inventory/format"
import {
  COLORS,
  CRIT_SHORT,
  CRIT_COLOR,
  CRIT_ORDER,
  DEMAND_COLOR,
  RISK_ORDER,
  RISK_META,
  STATUS_COLOR,
  CONF_ORDER,
} from "@/lib/inventory/ui/colors"
import { STATUS_DISPLAY, type ApprovalStatus } from "@/lib/inventory/approvals"
import type { Recommendation } from "@/lib/inventory/calc/types"

const CIRCUITS = ["Crushing", "Milling", "Pumping", "Filtration"]
const CRITICALITIES = ["CRITICAL", "HIGH", "MEDIUM"]
const DEMAND_PATTERNS = ["Smooth", "Erratic", "Intermittent", "Lumpy", "OAR"]
const RISK_LEVELS = ["Critical", "High", "Medium", "Low"]
const STATUSES: ApprovalStatus[] = ["NEEDS_REVIEW", "IN_APPROVAL", "APPROVED", "ADJUSTED", "REJECTED"]

interface Filters {
  plant: string
  circuit: string
  crit: string
  demand: string
  status: string
  risk: string
  search: string
}
const emptyFilters: Filters = { plant: "All", circuit: "All", crit: "All", demand: "All", status: "All", risk: "All", search: "" }

export default function InventoryOverviewPage() {
  const router = useRouter()
  const { data, recommendations, loading, error, approvals } = useInventory()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sortKey, setSortKey] = useState<"risk" | "valueChange" | "ropChange" | "crit" | "confidence">("risk")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Only physical, stock-managed materials participate in this dashboard -- service lines
  // carry no SS/ROP/Max recommendation (see RecommendationEngine.buildNotStockManaged).
  const stockManaged = useMemo(() => recommendations.filter((r) => !r.notStockManaged), [recommendations])

  const priceByMaterial = useMemo(() => new Map((data?.materials ?? []).map((m) => [m.id, m.last_po_price])), [data])
  const decision = useCallback((id: string) => approvals.getEntry(id).status, [approvals])

  const matches = useCallback(
    (r: Recommendation, f: Filters, skip: string | null) => {
      if (skip !== "plant" && f.plant !== "All" && r.plant !== f.plant) return false
      if (skip !== "circuit" && f.circuit !== "All" && r.circuit !== f.circuit) return false
      if (skip !== "crit" && f.crit !== "All" && r.criticality !== f.crit) return false
      if (skip !== "demand" && f.demand !== "All" && r.demandClass !== f.demand) return false
      if (skip !== "status" && f.status !== "All" && decision(r.materialId) !== f.status) return false
      if (skip !== "risk" && f.risk !== "All" && r.riskBefore !== f.risk) return false
      if (f.search.trim()) {
        const q = f.search.trim().toLowerCase()
        if (!r.materialCode.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false
      }
      return true
    },
    [decision],
  )

  const filteredRows = useMemo(() => stockManaged.filter((r) => matches(r, filters, null)), [stockManaged, filters, matches])
  const materialsInScope = useMemo(
    () => stockManaged.filter((r) => matches(r, { ...filters, search: "" }, null)).length,
    [stockManaged, filters, matches],
  )
  const criticalAtRisk = filteredRows.filter((r) => r.riskBefore === "Critical").length
  const pendingCount = filteredRows.filter((r) => decision(r.materialId) === "IN_APPROVAL").length

  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: f[key] === value ? "All" : value }))
  const clearAll = () => setFilters(emptyFilters)
  const anyFilterActive = Object.entries(filters).some(([k, v]) => (k === "search" ? v.trim() !== "" : v !== "All"))

  const statusData = STATUSES.map((s) => ({ name: s, count: stockManaged.filter((r) => matches(r, filters, "status") && decision(r.materialId) === s).length }))
  const demandData = DEMAND_PATTERNS.map((d) => ({ name: d, count: stockManaged.filter((r) => matches(r, filters, "demand") && r.demandClass === d).length }))
  const riskData = RISK_LEVELS.map((r) => ({ name: r, count: stockManaged.filter((row) => matches(row, filters, "risk") && row.riskBefore === r).length }))

  const value = useCallback((r: Recommendation) => r.current.recommendedROP * (priceByMaterial.get(r.materialId) ?? 0), [priceByMaterial])
  const curValue = useCallback((r: Recommendation) => r.current.currentROP * (priceByMaterial.get(r.materialId) ?? 0), [priceByMaterial])
  const totalCur = filteredRows.reduce((s, r) => s + curValue(r), 0)
  const totalRec = filteredRows.reduce((s, r) => s + value(r), 0)
  const deltaPct = totalCur > 0 ? (((totalRec - totalCur) / totalCur) * 100).toFixed(1) : "0.0"

  const sorted = useMemo(() => {
    const order: Record<string, Record<string, number>> = { risk: RISK_ORDER, crit: CRIT_ORDER, confidence: CONF_ORDER }
    const val = (r: Recommendation) => {
      if (sortKey === "valueChange") return value(r) - curValue(r)
      if (sortKey === "ropChange") return r.current.recommendedROP - r.current.currentROP
      if (sortKey === "risk") return order.risk[r.riskBefore]
      if (sortKey === "crit") return order.crit[r.criticality]
      return order.confidence[r.confidence]
    }
    return [...filteredRows].sort((a, b) => (val(a) - val(b)) * (sortDir === "asc" ? 1 : -1))
  }, [filteredRows, sortKey, sortDir, value, curValue])

  const STATUS_HEX: Record<string, string> = {
    NEEDS_REVIEW: COLORS.graySolid,
    IN_APPROVAL: COLORS.warning,
    ADJUSTED: COLORS.purple,
    APPROVED: COLORS.accent,
    REJECTED: COLORS.danger,
  }
  const DEMAND_HEX: Record<string, string> = { Smooth: COLORS.primary, Erratic: COLORS.warning, Intermittent: COLORS.coral, Lumpy: COLORS.danger, OAR: COLORS.graySolid }

  if (error) return <ErrorState message={error} />
  if (loading || !data) return <LoadingState />

  const plants = Array.from(new Set(data.materials.map((m) => m.plant))).sort()

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>Inventory optimization</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            Portfolio health at a glance -- every filter and chart below is cross-linked
          </p>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textLight }}>{data.materials.length} materials tracked</div>
      </div>

      {/* KPI HEADER */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <KPICard label="Materials in scope" value={materialsInScope.toLocaleString()} sub="Plant + circuit + criticality" />
        <KPICard
          label="At risk -- critical"
          value={criticalAtRisk}
          sub="Click to isolate"
          color={COLORS.danger}
          active={filters.risk === "Critical"}
          onClick={() => setFilter("risk", "Critical")}
        />
        <KPICard label="Recommendations" value={filteredRows.length} sub="Matching current filters" color={COLORS.warning} onClick={anyFilterActive ? clearAll : undefined} />
        <KPICard
          label="Pending approval"
          value={pendingCount}
          sub="Click to isolate"
          color={COLORS.warning}
          active={filters.status === "IN_APPROVAL"}
          onClick={() => setFilter("status", "IN_APPROVAL")}
        />
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* FILTER PANEL */}
        <div style={{ width: 200, flexShrink: 0, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Filters</div>
          <Select label="Plant" value={filters.plant} onChange={(v) => setFilters((f) => ({ ...f, plant: v }))} options={plants} />
          <Select label="Circuit" value={filters.circuit} onChange={(v) => setFilters((f) => ({ ...f, circuit: v }))} options={CIRCUITS} />
          <Select
            label="Criticality"
            value={filters.crit}
            onChange={(v) => setFilters((f) => ({ ...f, crit: v }))}
            options={CRITICALITIES}
            labelFor={(o) => CRIT_SHORT[o]}
          />
          <Select label="Demand pattern" value={filters.demand} onChange={(v) => setFilters((f) => ({ ...f, demand: v }))} options={DEMAND_PATTERNS} />
          <Select
            label="Recommendation status"
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={STATUSES}
            labelFor={(o) => STATUS_DISPLAY[o]}
          />
          <Select label="Stockout risk" value={filters.risk} onChange={(v) => setFilters((f) => ({ ...f, risk: v }))} options={RISK_LEVELS} />
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>Material</div>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: 9, color: COLORS.textLight }} />
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search material..."
                style={{ width: "100%", padding: "7px 8px 7px 26px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>
          <button
            onClick={clearAll}
            disabled={!anyFilterActive}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "7px 0",
              borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bg,
              color: anyFilterActive ? COLORS.text : COLORS.textLight,
              fontSize: 12,
              fontWeight: 600,
              cursor: anyFilterActive ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <RotateCcw size={12} /> Clear filters
          </button>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <Panel title="Recommendations">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="name" innerRadius={30} outerRadius={52} paddingAngle={2}>
                        {statusData.map((d) => (
                          <Cell
                            key={d.name}
                            fill={STATUS_HEX[d.name]}
                            style={{ cursor: "pointer", opacity: filters.status === "All" || filters.status === d.name ? 1 : 0.3 }}
                            onClick={() => setFilter("status", d.name)}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, STATUS_DISPLAY[String(name)] ?? String(name)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                  {statusData.map((d) => (
                    <div
                      key={d.name}
                      onClick={() => setFilter("status", d.name)}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0", cursor: "pointer", opacity: filters.status === "All" || filters.status === d.name ? 1 : 0.4 }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_HEX[d.name], display: "inline-block" }} />
                      <span style={{ color: COLORS.text }}>{STATUS_DISPLAY[d.name]}</span>
                      <span style={{ color: COLORS.textMuted, marginLeft: "auto" }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Inventory value (at ROP)">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Current</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.textMuted }}>{formatCurrencyCompact(totalCur)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Recommended</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: totalRec > totalCur ? COLORS.coral : COLORS.accent }}>{formatCurrencyCompact(totalRec)}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: totalRec === totalCur ? COLORS.textMuted : totalRec > totalCur ? COLORS.coral : COLORS.accent }}>
                  {totalRec === totalCur ? "→" : totalRec > totalCur ? "▲" : "▼"} {formatCurrencyCompact(Math.abs(totalRec - totalCur))}
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6 }}>
                    ({totalRec >= totalCur ? "+" : "-"}
                    {Math.abs(Number(deltaPct))}%)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>
                  {totalRec === totalCur ? "No change in recommended inventory" : totalRec > totalCur ? "Recommended inventory is higher" : "Recommended inventory is lower"}
                </div>
              </div>
            </Panel>

            <Panel title="Demand pattern">
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10.5, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={(d) => d.name && setFilter("demand", d.name)}>
                      {demandData.map((d) => (
                        <Cell key={d.name} fill={DEMAND_HEX[d.name]} style={{ cursor: "pointer", opacity: filters.demand === "All" || filters.demand === d.name ? 1 : 0.3 }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Stockout risk stacked bar */}
          <Panel title="Stockout risk" style={{ minWidth: "100%", marginBottom: 16 }}>
            {(() => {
              const totalRisk = riskData.reduce((s, d) => s + d.count, 0)
              if (totalRisk === 0) return <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "8px 0" }}>No materials match the current filters.</div>
              return (
                <>
                  <div style={{ display: "flex", height: 30, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
                    {riskData
                      .filter((d) => d.count > 0)
                      .map((d) => {
                        const pct = (d.count / totalRisk) * 100
                        const active = filters.risk === "All" || filters.risk === d.name
                        return (
                          <div
                            key={d.name}
                            onClick={() => setFilter("risk", d.name)}
                            title={`${d.name}: ${d.count}`}
                            style={{
                              width: `${pct}%`,
                              background: RISK_META[d.name].dot,
                              cursor: "pointer",
                              opacity: active ? 1 : 0.3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "opacity .15s",
                            }}
                          >
                            {pct > 7 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{d.count}</span>}
                          </div>
                        )
                      })}
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    {riskData.map((d) => (
                      <div
                        key={d.name}
                        onClick={() => setFilter("risk", d.name)}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", opacity: filters.risk === "All" || filters.risk === d.name ? 1 : 0.4 }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: RISK_META[d.name].dot, display: "inline-block" }} />
                        <span style={{ color: COLORS.text }}>{d.name}</span>
                        <span style={{ color: COLORS.textMuted, fontWeight: 700 }}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </Panel>

          {/* Detailed report */}
          <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                Detailed report -- {sorted.length} material{sorted.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>Sort</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  style={{ padding: "5px 6px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12 }}
                >
                  <option value="risk">Stockout risk</option>
                  <option value="valueChange">Value change</option>
                  <option value="ropChange">ROP change</option>
                  <option value="crit">Criticality</option>
                  <option value="confidence">Confidence</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  style={{ padding: 6, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.card, cursor: "pointer", display: "flex" }}
                >
                  {sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
                <thead>
                  <tr style={{ background: COLORS.tableHeaderBg }}>
                    {["Material", "Circuit", "Criticality", "Demand", "Value change", "Risk", "Status", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "9px 10px",
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
                  {sorted.slice(0, 100).map((r) => {
                    const delta = value(r) - curValue(r)
                    return (
                      <tr
                        key={r.materialId}
                        onClick={() => router.push(`/inventory/recommendations?focus=${r.materialId}`)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text }}>{r.materialCode}</div>
                          <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                        </td>
                        <td style={{ padding: "9px 10px", color: COLORS.text }}>{r.circuit}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <Badge color={CRIT_COLOR[r.criticality]}>{CRIT_SHORT[r.criticality]}</Badge>
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          <Badge color={DEMAND_COLOR[r.demandClass]}>{r.demandClass}</Badge>
                        </td>
                        <td style={{ padding: "9px 10px", fontWeight: 600, color: delta > 0 ? COLORS.coral : delta < 0 ? COLORS.accent : COLORS.textMuted }}>
                          {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                          {formatCurrencyCompact(Math.abs(delta))}
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          <Badge color={RISK_META[r.riskBefore].color}>{r.riskBefore}</Badge>
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          <Badge color={STATUS_COLOR[decision(r.materialId)]}>{STATUS_DISPLAY[decision(r.materialId)]}</Badge>
                        </td>
                        <td style={{ padding: "9px 10px", color: COLORS.primary, fontSize: 12, whiteSpace: "nowrap" }}>Review -&gt;</td>
                      </tr>
                    )
                  })}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                        No materials match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div style={{ padding: "8px 16px", fontSize: 11.5, color: COLORS.textLight, borderTop: `1px solid ${COLORS.border}` }}>
                Showing first 100 of {sorted.length} -- narrow the filters or open the Recommendations page for the full paginated list.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
