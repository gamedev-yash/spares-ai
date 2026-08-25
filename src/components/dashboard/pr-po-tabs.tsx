"use client"

import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { FlagsPanel } from "@/components/dashboard/flags-panel"
import { LiveCycleTimeTab } from "@/components/dashboard/live-cycle-time-tab"
import { PoValueDonut } from "@/components/dashboard/po-value-donut"
import { PrAgingChart } from "@/components/dashboard/pr-aging-chart"
import {
  AgingTable,
  CategoriesTable,
  OarVbTable,
  PoDetailTable,
  PoSummaryTable,
  PrSummaryTable,
} from "@/components/dashboard/vzi-tables"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TwoSeriesBarChart } from "@/components/dashboard/two-series-bar-chart"
import type { VziDashboard } from "@/lib/api/vzi"
import { formatCount, formatZARMillions } from "@/lib/utils"

const MATERIAL = { key: "material", name: "Material", color: "var(--chart-1)" }
const SERVICE = { key: "service", name: "Service", color: "var(--chart-2)" }
const GAMSBERG = { key: "Gamsberg", name: "Gamsberg", color: "var(--chart-3)" }
const BMM = { key: "BMM", name: "BMM", color: "var(--chart-4)" }
const OAR = { key: "oar", name: "OAR", color: "var(--chart-1)" }
const VB = { key: "vb", name: "VB", color: "var(--chart-2)" }
const MAT_VALUE = { key: "matValue", name: "Material", color: "var(--chart-1)" }
const SVC_VALUE = { key: "svcValue", name: "Service", color: "var(--chart-2)" }

export function PrPoTabs({ dashboard }: { dashboard: VziDashboard }) {
  const prByUnit: Record<string, number> = {}
  for (const r of dashboard.prSummary) prByUnit[r.unit] = r.material + r.service

  const oarVbData = ["Gamsberg", "BMM"].map((unit) => ({
    unit,
    oar: dashboard.oarVbByUnit[unit]?.oar ?? 0,
    vb: dashboard.oarVbByUnit[unit]?.vb ?? 0,
  }))
  const poCountData = dashboard.poSummary.map((r) => ({
    unit: r.unit,
    material: r.material,
    service: r.service,
  }))
  const poValueData = ["Gamsberg", "BMM"].map((unit) => ({
    unit,
    material: dashboard.poByUnit[unit]?.matValue ?? 0,
    service: dashboard.poByUnit[unit]?.svcValue ?? 0,
  }))
  const categoryData = [...dashboard.categoryPivot].reverse() // bottom-up -> largest on top
  const poAreaData = [...dashboard.poAreaSorted].reverse().map((r) => ({
    label: r.label,
    matValue: r.matValue,
    svcValue: r.svcValue,
  }))
  const poValue = dashboard.kpiSummary.openPoValue

  const miningTotal = dashboard.poAreaSorted
    .filter((r) => r.area === "Mining")
    .reduce((s, r) => s + r.total, 0)
  const miningAreaHint =
    poValue.total > 0
      ? `mining areas hold ${formatZARMillions(miningTotal)} (${((miningTotal / poValue.total) * 100).toFixed(1)}%)`
      : undefined

  return (
    <Tabs defaultValue="overview">
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent px-0 py-0"
      >
        <TabsTrigger value="overview" className="px-0.5 py-2.5 text-sm">
          Overview
        </TabsTrigger>
        <TabsTrigger value="prs" className="px-0.5 py-2.5 text-sm">
          Open PRs
        </TabsTrigger>
        <TabsTrigger value="pos" className="px-0.5 py-2.5 text-sm">
          Open POs
        </TabsTrigger>
        <TabsTrigger value="flags" className="px-0.5 py-2.5 text-sm">
          Data &amp; flags
        </TabsTrigger>
        <TabsTrigger value="live" className="px-0.5 py-2.5 text-sm">
          Live cycle time
        </TabsTrigger>
      </TabsList>

      {/* Panels share one grid cell so a panel stuck mid-exit-transition
          overlaps instead of pushing the page to double height. */}
      <div className="grid">
      <TabsContent
        value="overview"
        className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <DashboardCard
            title="PR aging distribution"
            subtitle={`Open PRs by age bucket · total ${formatCount(dashboard.aging.reduce((s, a) => s + a.count, 0))}`}
            span={7}
          >
            <PrAgingChart buckets={dashboard.aging} />
          </DashboardCard>
          <DashboardCard
            title="Where open PO value sits"
            subtitle={`Material vs service share of ${formatZARMillions(poValue.total)}`}
            span={5}
          >
            <PoValueDonut value={poValue} />
          </DashboardCard>
          <DashboardCard title="Observations" span={6}>
            <ul className="list-disc space-y-2.5 pl-4.5 text-[13px] leading-relaxed text-foreground">
              {dashboard.slideNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard title="What the numbers add up to" span={6}>
            <ul className="list-disc space-y-2.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-success">
              {dashboard.derivedNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      </TabsContent>

      <TabsContent
        value="prs"
        className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <DashboardCard
            title="Open PRs by unit and type"
            hint={`${Object.keys(prByUnit)
              .map((u) => `${u} ${formatCount(prByUnit[u])}`)
              .join(" · ")}`}
            span={6}
          >
            <TwoSeriesBarChart
              data={dashboard.prSummary}
              categoryKey="unit"
              seriesA={MATERIAL}
              seriesB={SERVICE}
              formatValue={(v) => `${formatCount(v)} PRs`}
            />
          </DashboardCard>
          <DashboardCard
            title="Material PRs by trigger — OAR vs VB"
            span={6}
          >
            <TwoSeriesBarChart
              data={oarVbData}
              categoryKey="unit"
              seriesA={OAR}
              seriesB={VB}
              stacked
              formatValue={(v) => `${formatCount(v)} PRs`}
            />
          </DashboardCard>
          <DashboardCard
            title="Material PRs by category"
            subtitle={`Sorted by total · ${formatCount(dashboard.categoryPivot.reduce((s, r) => s + r.total, 0))} material PRs`}
            span={12}
          >
            <TwoSeriesBarChart
              data={categoryData}
              categoryKey="category"
              seriesA={GAMSBERG}
              seriesB={BMM}
              orientation="horizontal"
              height={460}
              categoryWidth={140}
              formatValue={(v) => `${formatCount(v)} PRs`}
            />
          </DashboardCard>
          <DashboardCard
            title="OAR / VB by area"
            span={12}
          >
            <OarVbTable dashboard={dashboard} />
          </DashboardCard>
        </div>
      </TabsContent>

      <TabsContent
        value="pos"
        className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <DashboardCard
            title="Count by unit and type"
            hint={`${formatCount(dashboard.poSummary.reduce((s, r) => s + r.material + r.service, 0))} open POs`}
            span={6}
          >
            <TwoSeriesBarChart
              data={poCountData}
              categoryKey="unit"
              seriesA={MATERIAL}
              seriesB={SERVICE}
              formatValue={(v) => `${formatCount(v)} POs`}
            />
          </DashboardCard>
          <DashboardCard title="Value by unit and type" subtitle="ZAR Mn" span={6}>
            <TwoSeriesBarChart
              data={poValueData}
              categoryKey="unit"
              seriesA={MAT_VALUE}
              seriesB={SVC_VALUE}
              formatValue={(v) => formatZARMillions(v)}
            />
          </DashboardCard>
          <DashboardCard
            title="Open PO value by area"
            subtitle="Material + service, ZAR Mn, sorted by total"
            hint={miningAreaHint}
            span={12}
          >
            <TwoSeriesBarChart
              data={poAreaData}
              categoryKey="label"
              seriesA={MAT_VALUE}
              seriesB={SVC_VALUE}
              orientation="horizontal"
              stacked
              height={420}
              categoryWidth={150}
              formatValue={(v) => formatZARMillions(v)}
            />
          </DashboardCard>
          <DashboardCard title="Full PO detail" span={12}>
            <PoDetailTable dashboard={dashboard} />
          </DashboardCard>
        </div>
      </TabsContent>

      <TabsContent
        value="flags"
        className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <DashboardCard title="Points to confirm with the data owner" span={12}>
            <FlagsPanel flags={dashboard.flags} />
          </DashboardCard>
          <DashboardCard title="PR summary" span={6}>
            <PrSummaryTable dashboard={dashboard} />
          </DashboardCard>
          <DashboardCard title="PR aging" span={6}>
            <AgingTable dashboard={dashboard} />
          </DashboardCard>
          <DashboardCard title="PO summary" span={6}>
            <PoSummaryTable dashboard={dashboard} />
          </DashboardCard>
          <DashboardCard title="PR categories" span={6}>
            <CategoriesTable dashboard={dashboard} />
          </DashboardCard>
        </div>
      </TabsContent>

      <TabsContent
        value="live"
        className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
      >
        <LiveCycleTimeTab />
      </TabsContent>
      </div>
    </Tabs>
  )
}
