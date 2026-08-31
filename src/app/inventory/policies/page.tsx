"use client"

import { useState } from "react"
import { Settings as SettingsIcon, Users, Calculator, FileText, Info, ChevronRight } from "lucide-react"

import { useInventory } from "@/lib/inventory/context"
import { LoadingState, ErrorState } from "@/components/inventory/loading-state"
import { Badge } from "@/components/inventory/ui/primitives"
import { COLORS, colorMap, CRIT_LABEL, CRIT_COLOR } from "@/lib/inventory/ui/colors"
import { ILLUSTRATIVE_Z_FACTORS, REVIEW_PERIOD_MONTHS } from "@/lib/inventory/calc/config"
import type { Circuit, Criticality } from "@/lib/inventory/data/types"

const CIRCUITS: Circuit[] = ["Crushing", "Milling", "Pumping", "Filtration"]
const CRITICALITIES: Criticality[] = ["CRITICAL", "HIGH", "MEDIUM"]

export default function PoliciesPage() {
  const { data, loading, error } = useInventory()
  const [tab, setTab] = useState<"overview" | "settings">("overview")
  const [maxStockOption, setMaxStockOption] = useState<"A" | "B">("A")

  if (error) return <ErrorState message={error} />
  if (loading || !data) return <LoadingState />

  const policyByKey = new Map(data.criticalityPolicy.map((p) => [`${p.criticality}|${p.circuit}`, p]))

  return (
    <div style={{ minHeight: 0, flex: "1 1 auto", overflowY: "auto", padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, color: COLORS.text }}>Policies</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: COLORS.textMuted }}>Manage inventory policies and system parameters</p>

      <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 18 }}>
        {(
          [
            { id: "overview" as const, label: "Policy overview" },
            { id: "settings" as const, label: "System settings" },
          ]
        ).map((t) => (
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

      {tab === "settings" ? (
        <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 40, textAlign: "center" }}>
          <SettingsIcon size={22} color={COLORS.textLight} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>System settings coming soon</div>
          <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>Plant, integration, and notification settings will live here.</div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <SummaryCard
              icon={Users}
              iconColor="success"
              title="Criticality policy"
              desc="Service-level targets by criticality class and circuit"
              status="PENDING_SIGNOFF"
            />
            <SummaryCard icon={Calculator} iconColor="primary" title="Maximum stock policy" desc="Method used to calculate maximum stock recommendations" status="Not locked" />
            <div style={{ flex: 1, minWidth: 220, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, background: colorMap.purple.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={16} color={colorMap.purple.solid} />
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>Policy status</div>
                  <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 }}>All required policies must be approved to generate recommendations</div>
                </div>
              </div>
              <Badge color="warning">Awaiting business sign-off</Badge>
            </div>
          </div>

          {/* Criticality policy matrix */}
          <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                Criticality policy matrix <Info size={13} color={COLORS.textLight} />
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Service-level targets by criticality class and circuit -- from criticality_policy.csv</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: COLORS.tableHeaderBg }}>
                    {["Criticality", "Circuit", "Service level target", "Z factor", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{ padding: "9px 16px", textAlign: "left", fontWeight: 600, color: COLORS.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CRITICALITIES.flatMap((crit) =>
                    CIRCUITS.map((circuit) => {
                      const policy = policyByKey.get(`${crit}|${circuit}`)
                      return (
                        <tr key={`${crit}|${circuit}`} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: colorMap[CRIT_COLOR[crit]].solid }}>{CRIT_LABEL[crit]}</td>
                          <td style={{ padding: "10px 16px", color: COLORS.text }}>{circuit}</td>
                          <td style={{ padding: "10px 16px", color: COLORS.textLight, fontStyle: "italic" }}>{policy?.service_level_target_pct ?? "not set"}</td>
                          <td style={{ padding: "10px 16px", color: COLORS.text }}>
                            {policy?.z_factor ?? <span style={{ color: COLORS.textLight, fontStyle: "italic" }}>not set</span>}{" "}
                            <span style={{ color: COLORS.textLight, fontSize: 11.5 }}>(illustrative: {ILLUSTRATIVE_Z_FACTORS[crit].toFixed(2)})</span>
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <Badge color="warning">{policy?.status ?? "PENDING_SIGNOFF"}</Badge>
                          </td>
                        </tr>
                      )
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: COLORS.warningLight,
              borderRadius: 8,
              padding: "12px 14px",
              border: `1px solid ${COLORS.warningBorder}`,
              fontSize: 12.5,
              color: COLORS.warningTextStrong,
              marginBottom: 20,
            }}
          >
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              No service-level target or Z-factor has been signed off by the business yet. The Z-factors shown above are illustrative
              placeholders only (config.ts), used so the recommendation engine has something to compute with -- they are not approved policy.
            </span>
          </div>

          {/* Maximum stock policy */}
          <div style={{ background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
              Maximum stock policy <Info size={13} color={COLORS.textLight} />
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>
              Neither option is locked policy yet -- both are computed and shown on every recommendation. Click to preview each formula.
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {(
                [
                  { key: "A" as const, title: "Option A -- Economic order quantity (EOQ) based", desc: "Considers ordering cost and holding cost" },
                  { key: "B" as const, title: "Option B -- Review-period based", desc: "Uses a review period per criticality class" },
                ]
              ).map((opt) => {
                const active = maxStockOption === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setMaxStockOption(opt.key)}
                    style={{ flex: "1 1 260px", textAlign: "left", borderRadius: 10, border: `1px solid ${active ? COLORS.accent : COLORS.border}`, padding: 14, background: COLORS.card, cursor: "pointer", font: "inherit" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          border: `2px solid ${active ? COLORS.accent : COLORS.textLight}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 2,
                          flexShrink: 0,
                        }}
                      >
                        {active && <span style={{ width: 7, height: 7, borderRadius: 4, background: COLORS.accent, display: "block" }} />}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{opt.desc}</div>
                        {active && (
                          <div style={{ fontSize: 11.5, fontFamily: "monospace", color: COLORS.text, background: COLORS.tableHeaderBg, borderRadius: 6, padding: "6px 8px" }}>
                            {opt.key === "A" ? (
                              <>
                                EOQ = √(2 × D_annual × S / (H × P))
                                <br />
                                Max = SS + EOQ
                              </>
                            ) : (
                              <>
                                Max = ROP + (D_avg × T)
                                <br />T by criticality: A={REVIEW_PERIOD_MONTHS.CRITICAL}mo, B={REVIEW_PERIOD_MONTHS.HIGH}mo, C=
                                {REVIEW_PERIOD_MONTHS.MEDIUM}mo
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  iconColor,
  title,
  desc,
  status,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  iconColor: "success" | "primary"
  title: string
  desc: string
  status: string
}) {
  return (
    <div style={{ flex: 1, minWidth: 220, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 17, background: colorMap[iconColor].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} color={colorMap[iconColor].solid} />
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{title}</div>
          <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 }}>{desc}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Badge color="warning">{status}</Badge>
        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: COLORS.textMuted }}>
          Configured in code <ChevronRight size={12} />
        </span>
      </div>
    </div>
  )
}
