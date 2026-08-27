"use client"

import { useEffect, useState } from "react"
import { Lightbulb } from "lucide-react"

import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { TwoSeriesBarChart } from "@/components/dashboard/two-series-bar-chart"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/lib/api/client"
import { getUtilizationDashboard, type UtilizationDashboard } from "@/lib/api/utilization"
import { formatQty } from "@/lib/utilization-format"
import { formatCount, formatZAR, formatZARCompact } from "@/lib/utils"

const VALUE = { key: "value", name: "Value", color: "var(--chart-1)" }
const OVERDUE = { key: "value", name: "Overdue value", color: "var(--chart-2)" }
const PLANNED = { key: "planned", name: "Planned", color: "var(--chart-1)" }
const ACTUAL = { key: "actual", name: "Actual", color: "var(--chart-3)" }

function panelClass() {
  return "col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
}

export function AnalyticsTabs() {
  const [dashboard, setDashboard] = useState<UtilizationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUtilizationDashboard()
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load analytics."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton className="h-96 rounded-xl" />
  if (error || !dashboard) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error ?? "No data."}</div>

  const { unutilizedPosition: up, planCompliance: pc, nmSmInflow: nm, redeployment: rd, reclassification: rc, insights } = dashboard

  return (
    <div className="flex flex-col gap-4">
      {insights.length > 0 && (
        <DashboardCard title="Patterns worth a look">
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {insight}
              </li>
            ))}
          </ul>
        </DashboardCard>
      )}

      <Tabs defaultValue="unutilized">
        <TabsList variant="line" className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border bg-transparent px-0 py-0">
          <TabsTrigger value="unutilized" className="px-0.5 py-2.5 text-sm">Unutilized OAR</TabsTrigger>
          <TabsTrigger value="compliance" className="px-0.5 py-2.5 text-sm">Plan Compliance</TabsTrigger>
          <TabsTrigger value="nmsm" className="px-0.5 py-2.5 text-sm">NM/SM Inflow</TabsTrigger>
          <TabsTrigger value="redeployment" className="px-0.5 py-2.5 text-sm">Redeployment &amp; Avoidance</TabsTrigger>
          <TabsTrigger value="reclassification" className="px-0.5 py-2.5 text-sm">Reclassification</TabsTrigger>
        </TabsList>

        <div className="grid">
          <TabsContent value="unutilized" className={panelClass()}>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-12 lg:grid-cols-5">
                {[
                  { label: "Unutilized OAR value", figure: formatZAR(up.kpis.unutilizedOarValue) },
                  { label: "Unutilized OAR lines", figure: formatCount(up.kpis.unutilizedOarLines) },
                  { label: "Overdue value", figure: formatZAR(up.kpis.overdueValue), tone: "danger" as const },
                  { label: "Critical exceptions", figure: formatCount(up.kpis.criticalExceptions), tone: "danger" as const },
                  { label: "Released for redeployment", figure: formatZAR(up.kpis.releasedForRedeployment), tone: "success" as const },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                    <div className={`mt-1.5 text-2xl font-semibold ${c.tone === "danger" ? "text-destructive" : c.tone === "success" ? "text-success" : "text-foreground"}`}>{c.figure}</div>
                  </div>
                ))}
              </div>
              <DashboardCard title="Unutilized value by age bucket" span={7}>
                <TwoSeriesBarChart data={up.byAgeBucket} categoryKey="bucket" seriesA={OVERDUE} formatValue={formatZARCompact} height={280} />
              </DashboardCard>
              <DashboardCard title="Unutilized value by plant" span={5}>
                <TwoSeriesBarChart data={up.byPlant} categoryKey="plant" seriesA={VALUE} formatValue={formatZARCompact} height={280} />
              </DashboardCard>
              <DashboardCard title="Unutilized value by department" span={6}>
                <TwoSeriesBarChart data={up.byDepartment} categoryKey="department" seriesA={VALUE} orientation="horizontal" categoryWidth={160} formatValue={formatZARCompact} height={260} />
              </DashboardCard>
              <DashboardCard title="Top materials by unused value" span={6}>
                <TwoSeriesBarChart data={up.topMaterials} categoryKey="material" seriesA={VALUE} orientation="horizontal" categoryWidth={200} formatValue={formatZARCompact} height={260} />
              </DashboardCard>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className={panelClass()}>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-12 lg:grid-cols-5">
                {[
                  { label: "Complete plans", figure: `${pc.kpis.completePlansPct}%` },
                  { label: "On-time consumption", figure: `${pc.kpis.onTimeConsumptionPct}%`, tone: "success" as const },
                  { label: "Re-plan rate", figure: `${pc.kpis.replanRatePct}%` },
                  { label: "Confirmation compliance", figure: `${pc.kpis.confirmationCompliancePct}%` },
                  { label: "Avg days past plan", figure: formatCount(pc.kpis.avgDaysPastPlan), tone: "danger" as const },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                    <div className={`mt-1.5 text-2xl font-semibold ${c.tone === "danger" ? "text-destructive" : c.tone === "success" ? "text-success" : "text-foreground"}`}>{c.figure}</div>
                  </div>
                ))}
              </div>
              <DashboardCard title="Plan compliance by department" subtitle="% of lines consumed on time or not yet due" span={6}>
                <TwoSeriesBarChart data={pc.byDepartment} categoryKey="department" seriesA={{ key: "compliancePct", name: "Compliance %", color: "var(--chart-3)" }} orientation="horizontal" categoryWidth={160} formatValue={(v) => `${v}%`} height={240} />
              </DashboardCard>
              <DashboardCard title="Planned vs actual consumption" span={6}>
                <TwoSeriesBarChart data={pc.trend} categoryKey="month" seriesA={PLANNED} seriesB={ACTUAL} formatValue={formatCount} height={240} />
              </DashboardCard>
              <DashboardCard title="Re-plan reasons" span={6}>
                <Table>
                  <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pc.replanReasons.map((r) => (
                      <TableRow key={r.reason}><TableCell className="text-foreground">{r.reason}</TableCell><TableCell className="text-right text-foreground">{r.count}</TableCell></TableRow>
                    ))}
                    {pc.replanReasons.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No re-plans recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </DashboardCard>
              <DashboardCard title="Requester compliance ranking" subtitle="Most overdue confirmations" span={6}>
                <Table>
                  <TableHeader><TableRow><TableHead>Requester</TableHead><TableHead className="text-right">Overdue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pc.requesterRanking.map((r) => (
                      <TableRow key={r.requester}><TableCell className="text-foreground">{r.requester}</TableCell><TableCell className="text-right text-destructive">{r.overdueCount}</TableCell></TableRow>
                    ))}
                    {pc.requesterRanking.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No overdue confirmations.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </DashboardCard>
            </div>
          </TabsContent>

          <TabsContent value="nmsm" className={panelClass()}>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-12">
                {[
                  { label: "Newly aged OAR value", figure: formatZAR(nm.kpis.newlyAgedValue), tone: "danger" as const },
                  { label: "NM/SM risk value", figure: formatZAR(nm.kpis.riskValue), tone: "danger" as const },
                  { label: "Avoided NM/SM value", figure: formatZAR(nm.kpis.avoidedValue), tone: "success" as const },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                    <div className={`mt-1.5 text-2xl font-semibold ${c.tone === "danger" ? "text-destructive" : "text-success"}`}>{c.figure}</div>
                  </div>
                ))}
              </div>
              <DashboardCard title="Monthly NM/SM inflow" subtitle="Value newly crossing into overdue/critical aging, by planned-consumption month" span={12}>
                <TwoSeriesBarChart data={nm.monthlyInflow} categoryKey="month" seriesA={{ key: "value", name: "Newly aged value", color: "var(--destructive)" }} formatValue={formatZARCompact} height={300} />
              </DashboardCard>
              <DashboardCard title="Reading this chart" span={12} footnote="Early intervention (Confirm / Re-plan / Release) keeps items out of this chart before they reach 30+ days overdue.">
                <p className="text-[13px] text-muted-foreground">
                  Initiative 9 creates better demand, Initiative 10 finds alternatives, and Initiative 13 makes sure the
                  requested spare is actually used — intervening before unused OAR material turns into slow/non-moving inventory.
                </p>
              </DashboardCard>
            </div>
          </TabsContent>

          <TabsContent value="redeployment" className={panelClass()}>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-12 lg:grid-cols-6">
                {[
                  { label: "Purchase avoidance value", figure: formatZAR(rd.kpis.purchaseAvoidanceValue), tone: "success" as const },
                  { label: "Transfers recommended", figure: formatCount(rd.kpis.transfersRecommended) },
                  { label: "Transfers accepted", figure: formatCount(rd.kpis.transfersAccepted), tone: "success" as const },
                  { label: "Released stock value", figure: formatZAR(rd.kpis.releasedStockValue) },
                  { label: "Exact matches", figure: formatCount(rd.kpis.exactMatches) },
                  { label: "Approved alternate matches", figure: formatCount(rd.kpis.approvedAlternateMatches) },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                    <div className={`mt-1.5 text-2xl font-semibold ${c.tone === "success" ? "text-success" : "text-foreground"}`}>{c.figure}</div>
                  </div>
                ))}
              </div>
              <DashboardCard title="Redeployment decisions" span={12}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested material</TableHead>
                      <TableHead>Existing material</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Avoided value</TableHead>
                      <TableHead>Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rd.recommendations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[200px] truncate text-foreground">{r.requested_material_description}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-foreground">{r.matched_material_description}</TableCell>
                        <TableCell className="text-muted-foreground">{r.requested_plant} → {r.matched_plant}</TableCell>
                        <TableCell className="text-muted-foreground">{r.match_type}</TableCell>
                        <TableCell className="text-right text-foreground">{formatQty(r.matched_qty)}</TableCell>
                        <TableCell className="text-right text-foreground">{formatZAR(r.avoided_value)}</TableCell>
                        <TableCell><StatusBadge tone={r.decision === "PENDING" ? "default" : r.decision === "PURCHASE" ? "warning" : "success"}>{r.decision.replaceAll("_", " ")}</StatusBadge></TableCell>
                      </TableRow>
                    ))}
                    {rd.recommendations.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No redeployment recommendations recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </DashboardCard>
            </div>
          </TabsContent>

          <TabsContent value="reclassification" className={panelClass()}>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <DashboardCard title="Reclassification candidates" subtitle="OAR materials consumed more than 4 times — candidates for planning review" span={12}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead className="text-right">Annual events</TableHead>
                      <TableHead className="text-right">Annual qty</TableHead>
                      <TableHead>Current status</TableHead>
                      <TableHead>Suggested action</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rc.candidates.map((c) => (
                      <TableRow key={c.material_id}>
                        <TableCell className="text-foreground">{c.description} ({c.material_code})</TableCell>
                        <TableCell className="text-muted-foreground">{c.plant}</TableCell>
                        <TableCell className="text-right text-foreground">{c.annual_consumption_events}</TableCell>
                        <TableCell className="text-right text-foreground">{formatQty(c.annual_quantity)}</TableCell>
                        <TableCell><StatusBadge tone="warning">{c.current_oar_status}</StatusBadge></TableCell>
                        <TableCell className="text-muted-foreground">{c.suggested_action}</TableCell>
                        <TableCell className="text-right text-foreground">{c.confidence}%</TableCell>
                      </TableRow>
                    ))}
                    {rc.candidates.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No reclassification candidates yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </DashboardCard>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
