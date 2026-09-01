"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Search, Boxes, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { Select, Panel, Badge, PillSelect } from "@/components/inventory/ui/primitives"
import { deriveMonthWindow } from "@/lib/inventory/calc/months"
import { formatCurrencyCompact } from "@/lib/inventory/format"
import {
  COLORS,
  colorMap,
  CRIT_SHORT,
  CRIT_COLOR,
  CRIT_ORDER,
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

/** Smoothing constant for the portfolio-level demand forecast on this page. Deliberately more
 * responsive than calc/config's SBA_ALPHA (0.1), which is tuned for per-item intermittent
 * demand -- this series is an aggregate across many materials, where a 0.1 level barely moves. */
const PORTFOLIO_FORECAST_ALPHA = 0.3

const pctOf = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "--")

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
  const [demandMonths, setDemandMonths] = useState(6)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

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

  /**
   * Portfolio demand: actual monthly consumption for the materials currently in view, paired
   * with a one-step-ahead simple-exponential-smoothing forecast of that same series. Each
   * forecast point is the smoothed level from the PRIOR month only, so the line is a genuine
   * out-of-sample baseline rather than a curve fitted to the answer. The first month has no
   * prior data and is therefore left null (recharts skips it via connectNulls).
   */
  const demandSeries = useMemo(() => {
    const months = deriveMonthWindow(data?.consumptionHistory ?? [])
    if (months.length === 0) return []
    const inView = new Set(filteredRows.map((r) => r.materialId))
    if (inView.size === 0) return []

    const actualByMonth = new Map<string, number>()
    for (const row of data?.consumptionHistory ?? []) {
      if (!inView.has(row.material_id)) continue
      actualByMonth.set(row.period_month, (actualByMonth.get(row.period_month) ?? 0) + row.qty_consumed)
    }

    let level = actualByMonth.get(months[0]) ?? 0
    const series = months.map((m, i) => {
      const actual = actualByMonth.get(m) ?? 0
      const forecast = i === 0 ? null : Math.round(level)
      if (i > 0) level = PORTFOLIO_FORECAST_ALPHA * actual + (1 - PORTFOLIO_FORECAST_ALPHA) * level
      const [year, month] = m.split("-").map(Number)
      return {
        label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-ZA", { month: "short", timeZone: "UTC" }),
        actual,
        forecast,
      }
    })
    return series.slice(-demandMonths)
  }, [data, filteredRows, demandMonths])

  // Pagination is clamped during render rather than reset via an effect -- narrowing the
  // filters can shrink the result set below the current page, and clamping keeps the table
  // showing real rows without an extra render pass.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const rangeFrom = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeTo = Math.min(safePage * pageSize, sorted.length)
  const pageNumbers = buildPageNumbers(safePage, totalPages)

  // Derived from STATUS_COLOR rather than re-listed, so the donut/legend here always match
  // the status badges on Recommendations and Approvals.
  const STATUS_HEX: Record<string, string> = Object.fromEntries(
    STATUSES.map((s) => [s, colorMap[STATUS_COLOR[s]].solid]),
  )
  const DEMAND_HEX: Record<string, string> = { Smooth: COLORS.primary, Erratic: COLORS.warning, Intermittent: COLORS.coral, Lumpy: COLORS.danger, OAR: COLORS.graySolid }

  if (error) return <ErrorState message={error} />
  if (loading || !data) return <LoadingState />

  const plants = Array.from(new Set(data.materials.map((m) => m.plant))).sort()

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: COLORS.text }}>Inventory optimization</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.textMuted }}>
            Portfolio health at a glance -- every filter and chart below is cross-linked
          </p>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textLight }}>{data.materials.length} materials tracked</div>
      </div>

      {/* KPI HEADER */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard
          label="Materials in Scope"
          value={materialsInScope.toLocaleString()}
          unit={`/ ${data.materials.length} tracked`}
          caption="Stock-managed"
          captionColor={COLORS.textMuted}
          icon={Boxes}
          color={COLORS.primary}
        />
        <StatCard
          label="Critical Stockout Risk"
          value={criticalAtRisk}
          unit="Materials"
          caption={`${pctOf(criticalAtRisk, materialsInScope)} of in-scope`}
          captionColor={COLORS.danger}
          icon={AlertTriangle}
          color={COLORS.danger}
          active={filters.risk === "Critical"}
          onClick={() => setFilter("risk", "Critical")}
        />
        <StatCard
          label="Recommendations"
          value={filteredRows.length}
          unit="Match current filters"
          caption={`${pctOf(filteredRows.length, materialsInScope)} of in-scope`}
          captionColor={COLORS.accent}
          icon={CheckCircle2}
          color={COLORS.accent}
          onClick={anyFilterActive ? clearAll : undefined}
        />
        <StatCard
          label="Pending Approval"
          value={pendingCount}
          unit="Materials"
          caption={`${pctOf(pendingCount, filteredRows.length)} of recommendations`}
          captionColor={COLORS.warning}
          icon={Clock}
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

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {/* Stockout risk -- vertical stacked column + legend */}
            <Panel title="Stockout Risk Distribution" style={{ flex: "0 1 270px", marginBottom: 0 }}>
              {(() => {
                const totalRisk = riskData.reduce((s, d) => s + d.count, 0)
                if (totalRisk === 0) return <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "8px 0" }}>No materials match the current filters.</div>
                return (
                  <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                    <div style={{ width: 32, height: 150, borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
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
                              style={{ height: `${pct}%`, background: RISK_META[d.name].dot, cursor: "pointer", opacity: active ? 1 : 0.3, transition: "opacity .15s" }}
                            />
                          )
                        })}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                      {riskData.map((d) => (
                        <div
                          key={d.name}
                          onClick={() => setFilter("risk", d.name)}
                          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer", opacity: filters.risk === "All" || filters.risk === d.name ? 1 : 0.4 }}
                        >
                          <span style={{ width: 9, height: 9, borderRadius: 5, background: RISK_META[d.name].dot, display: "inline-block", flexShrink: 0 }} />
                          <span style={{ color: COLORS.text }}>{d.name}</span>
                          <span style={{ color: COLORS.textMuted, marginLeft: "auto", whiteSpace: "nowrap" }}>
                            {`${d.count} (${((d.count / totalRisk) * 100).toFixed(1)}%)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </Panel>

            {/* Forecast vs actual demand */}
            <Panel title="Forecast vs Actual Demand" style={{ flex: "1 1 400px", marginBottom: 0 }}>
              {demandSeries.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "8px 0" }}>No consumption history for the current filters.</div>
              ) : (
                <>
                  <div style={{ height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={demandSeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid stroke={COLORS.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: COLORS.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis
                          tick={{ fontSize: 10.5, fill: COLORS.textMuted }}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                          label={{ value: "Units", angle: -90, position: "insideLeft", style: { fontSize: 10.5, fill: COLORS.textMuted } }}
                        />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card }} />
                        <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="plainline" />
                        <Line type="monotone" dataKey="forecast" name="Forecast" stroke={COLORS.primary} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                        <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.accent} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: COLORS.textMuted }}>Show:</span>
                    <PillSelect
                      value={String(demandMonths)}
                      onChange={(v) => setDemandMonths(Number(v))}
                      options={[
                        { value: "6", label: "Last 6 Months" },
                        { value: "12", label: "Last 12 Months" },
                        { value: "24", label: "All history" },
                      ]}
                    />
                  </div>
                  <div style={{ fontSize: 10.5, color: COLORS.textLight, marginTop: 6, lineHeight: 1.4 }}>
                    {`Actual = consumption for the ${filteredRows.length} material(s) in view. Forecast = one-step-ahead exponential smoothing on that same series, so each point uses only prior months.`}
                  </div>
                </>
              )}
            </Panel>
          </div>

          {/* Detailed report */}
          <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>
                Material Recommendations
                <span style={{ fontWeight: 500, fontSize: 12, color: COLORS.textMuted, marginLeft: 6 }}>
                  {sorted.length === 0 ? "(none match)" : `(Showing ${rangeFrom} - ${rangeTo} of ${sorted.length})`}
                </span>
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
                    {["Material No.", "Material Description", "Circuit", "Crit.", "Demand Pattern", "Stockout Risk", "Value Change (₹)", "ROP Change", "Status", ""].map((h) => (
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
                  {pageRows.map((r) => {
                    const delta = value(r) - curValue(r)
                    const base = curValue(r)
                    // Percentage is only meaningful against a non-zero current level; a material
                    // with no ROP set has no baseline to be a percentage of.
                    const deltaPctLabel = base > 0 ? `(${delta >= 0 ? "+" : "-"}${Math.abs((delta / base) * 100).toFixed(0)}%)` : "(new)"
                    const ropDelta = r.current.recommendedROP - r.current.currentROP
                    return (
                      <tr
                        key={r.materialId}
                        onClick={() => router.push(`/inventory/recommendations?focus=${r.materialId}`)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <FileText size={12} color={COLORS.textLight} />
                            <span style={{ fontWeight: 600, color: COLORS.primary }}>{r.materialCode}</span>
                          </span>
                        </td>
                        <td style={{ padding: "9px 10px", color: COLORS.text }}>
                          <div style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                        </td>
                        <td style={{ padding: "9px 10px", color: COLORS.text }}>{r.circuit}</td>
                        <td style={{ padding: "9px 10px", fontWeight: 800, color: colorMap[CRIT_COLOR[r.criticality]].solid }}>{CRIT_SHORT[r.criticality]}</td>
                        <td style={{ padding: "9px 10px", color: COLORS.text }}>{r.demandClass}</td>
                        <td style={{ padding: "9px 10px" }}>
                          <Badge color={RISK_META[r.riskBefore].color}>{r.riskBefore}</Badge>
                        </td>
                        <td style={{ padding: "9px 10px", fontWeight: 600, whiteSpace: "nowrap", color: delta > 0 ? COLORS.coral : delta < 0 ? COLORS.accent : COLORS.textMuted }}>
                          {`${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formatCurrencyCompact(Math.abs(delta))} ${deltaPctLabel}`}
                        </td>
                        <td style={{ padding: "9px 10px", fontWeight: 600, whiteSpace: "nowrap", color: ropDelta > 0 ? COLORS.coral : ropDelta < 0 ? COLORS.accent : COLORS.textMuted }}>
                          {`${ropDelta > 0 ? "+" : ""}${ropDelta} units`}
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
                      <td colSpan={10} style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                        No materials match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sorted.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  padding: "8px 14px",
                  borderTop: `1px solid ${COLORS.border}`,
                }}
              >
                <button
                  onClick={() => router.push("/inventory/recommendations")}
                  style={{ background: "none", border: "none", padding: 0, color: COLORS.primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  All recommendations -&gt;
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PageButton disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                    <ChevronLeft size={13} />
                  </PageButton>
                  {pageNumbers.map((p, i) =>
                    p === null ? (
                      <span key={`gap-${i}`} style={{ fontSize: 12, color: COLORS.textLight }}>
                        ...
                      </span>
                    ) : (
                      <PageButton key={p} active={p === safePage} onClick={() => setPage(p)}>
                        {p}
                      </PageButton>
                    ),
                  )}
                  <PageButton disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                    <ChevronRight size={13} />
                  </PageButton>
                  <PillSelect
                    value={String(pageSize)}
                    onChange={(v) => {
                      setPageSize(Number(v))
                      setPage(1)
                    }}
                    options={[
                      { value: "25", label: "Show 25" },
                      { value: "50", label: "Show 50" },
                      { value: "100", label: "Show 100" },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Overview KPI tile: big coloured figure, a unit/qualifier beside it, a percentage caption
 * underneath, and a tinted icon badge on the right. Local to this page rather than added to
 * ui/primitives because only the Overview header uses this denser layout. */
function StatCard({
  label,
  value,
  unit,
  caption,
  captionColor,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string
  value: React.ReactNode
  unit: string
  caption: string
  captionColor: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 190px",
        textAlign: "left",
        background: COLORS.card,
        borderRadius: 10,
        padding: "14px 16px",
        border: `1px solid ${active ? color : COLORS.border}`,
        cursor: onClick ? "pointer" : "default",
        font: "inherit",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{unit}</span>
        </div>
        <div style={{ fontSize: 11, color: captionColor, marginTop: 6, fontWeight: 600 }}>{caption}</div>
      </div>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.bg,
        }}
      >
        <Icon size={15} color={color} />
      </span>
    </button>
  )
}

/** Compact page list: always the first page, a window around the current one, and the last,
 * with nulls standing in for the gaps the caller renders as an ellipsis. */
function buildPageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | null)[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null)
    out.push(p)
    prev = p
  }
  return out
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 26,
        height: 26,
        padding: "0 6px",
        borderRadius: 6,
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        background: active ? COLORS.primaryLight : COLORS.card,
        color: disabled ? COLORS.textLight : active ? COLORS.primary : COLORS.text,
        fontSize: 11.5,
        fontWeight: active ? 700 : 500,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  )
}
