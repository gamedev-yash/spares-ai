import { PageHeader } from "@/components/shared/page-header"
import { ChartCard } from "@/components/shared/chart-card"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { TrendLineChart } from "@/features/initiative-7/components/trend-line-chart"
import { EXCESS_INVENTORY_TREND, STOCKOUT_RISK_TREND } from "@/features/initiative-7/data/monitoring-series"

export function InventoryMonitoringPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Monitoring"
          description="Stockout risk trend, excess opportunity, and recommendation status over time."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard
            title="Stockout risk trend"
            subtitle="Materials at high/critical stockout risk, tracked monthly."
            span={6}
          >
            <TrendLineChart data={STOCKOUT_RISK_TREND} color="var(--destructive)" height={280} />
          </ChartCard>
          <ChartCard
            title="Excess inventory opportunity"
            subtitle="Cumulative ZAR working-capital opportunity identified, tracked monthly."
            span={6}
          >
            <TrendLineChart
              data={EXCESS_INVENTORY_TREND}
              color="var(--chart-3)"
              format="zar"
              height={280}
            />
          </ChartCard>

          <ChartCard title="Recommendation status distribution" span={5}>
            <RecommendationStatusChart />
          </ChartCard>
          <ChartCard
            title="Circuit exposure"
            subtitle="Recommendations per circuit, split by stockout-risk exposure."
            span={7}
          >
            <CircuitExposureChart />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
