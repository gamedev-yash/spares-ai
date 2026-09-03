import { PageHeader } from "@/components/shared/page-header"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { formatCount } from "@/lib/utils"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { RecentRecommendationsList } from "@/features/initiative-7/components/recent-recommendations-list"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { TrendLineChart } from "@/features/initiative-7/components/trend-line-chart"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { EXCESS_INVENTORY_TREND, STOCKOUT_RISK_TREND } from "@/features/initiative-7/data/monitoring-series"
import {
  countAtStockoutRisk,
  countAwaitingApproval,
  countByCriticality,
  countExcessCandidates,
  formatSignedZAR,
  netWorkingCapitalImpact,
} from "@/features/initiative-7/utils/inventory-calc"

export function InventoryOptimizationOverviewPage() {
  const criticalMaterials = countByCriticality(RECOMMENDATIONS, "Critical")
  const stockoutRisk = countAtStockoutRisk(RECOMMENDATIONS)
  const excessCandidates = countExcessCandidates(RECOMMENDATIONS)
  const awaitingApproval = countAwaitingApproval(RECOMMENDATIONS)
  const netImpact = netWorkingCapitalImpact(RECOMMENDATIONS)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Inventory Optimization"
          description="Criticality-aware ROP, safety-stock and max-stock recommendations."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPIStatCard label="Critical materials monitored" value={formatCount(criticalMaterials)} />
          <KPIStatCard label="At stockout risk" value={formatCount(stockoutRisk)} hint="High + critical risk" />
          <KPIStatCard label="Excess inventory candidates" value={formatCount(excessCandidates)} />
          <KPIStatCard label="Recommendations generated" value={formatCount(RECOMMENDATIONS.length)} />
          <KPIStatCard label="Awaiting approval" value={formatCount(awaitingApproval)} />
          <KPIStatCard
            label="Net working-capital impact"
            value={formatSignedZAR(netImpact)}
            trend={netImpact >= 0 ? "up" : "down"}
            hint={netImpact >= 0 ? "Net release" : "Net additional investment"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard title="Inventory health" span={4}>
            <InventoryHealthCard />
          </ChartCard>
          <ChartCard
            title="Critical circuit exposure"
            subtitle="Recommendations per circuit, split by stockout-risk exposure."
            span={8}
          >
            <CircuitExposureChart />
          </ChartCard>

          <ChartCard title="Recommendation status" span={4}>
            <RecommendationStatusChart />
          </ChartCard>
          <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={4}>
            <TrendLineChart data={STOCKOUT_RISK_TREND} color="var(--destructive)" />
          </ChartCard>
          <ChartCard
            title="Excess inventory opportunity"
            subtitle="Cumulative working-capital opportunity identified, by month."
            span={4}
          >
            <TrendLineChart data={EXCESS_INVENTORY_TREND} color="var(--chart-3)" format="zar" />
          </ChartCard>

          <ChartCard
            title="Recent recommendations"
            subtitle="Most recently generated — open one for the full explainability workspace."
            span={12}
          >
            <RecentRecommendationsList />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
