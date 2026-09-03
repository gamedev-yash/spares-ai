import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { getPlantById } from "@/lib/shared-data/plants"
import { formatZAR } from "@/lib/utils"
import { ApprovalWorkflowPanel } from "@/features/initiative-7/components/approval-workflow-panel"
import { ChampionChallengerCards } from "@/features/initiative-7/components/champion-challenger-cards"
import { ConsumptionHistoryChart } from "@/features/initiative-7/components/consumption-history-chart"
import { OarColdStartPanel } from "@/features/initiative-7/components/oar-cold-start-panel"
import { ParameterComparison } from "@/features/initiative-7/components/parameter-comparison"
import { RepairContextSignal } from "@/features/initiative-7/components/repair-context-signal"
import { WhyRecommended } from "@/features/initiative-7/components/why-recommended"
import { getRecommendationById } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const STATUS_TONE: Record<Recommendation["status"], "default" | "success" | "warning" | "danger"> = {
  "Pending Review": "default",
  "In Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  Returned: "warning",
  Implemented: "success",
}

export function RecommendationDetailPage({ recommendationId }: { recommendationId: string }) {
  const recommendation = getRecommendationById(recommendationId)

  if (!recommendation) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title="Recommendation not found" />
          <EmptyState
            title={`No recommendation "${recommendationId}"`}
            description="It may have been superseded — return to the Recommendation Workspace to find the current one."
            actions={
              <Link
                href="/inventory-optimization/recommendations"
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to Recommendations
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const plant = getPlantById(recommendation.plantId)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Link
          href="/inventory-optimization/recommendations"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Recommendations
        </Link>

        <PageHeader
          title={recommendation.material.description}
          description={`${recommendation.material.materialId} · ${plant?.name ?? recommendation.plantId} · ${recommendation.circuit} circuit`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={recommendation.risk} />
              <StatusBadge tone={STATUS_TONE[recommendation.status]}>{recommendation.status}</StatusBadge>
            </div>
          }
        />

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1">Criticality: {recommendation.criticality}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Demand pattern: {recommendation.demandPattern}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Lead time: {recommendation.leadTimeDays}d (±{recommendation.leadTimeVarianceDays}d)</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Unit price: {formatZAR(recommendation.unitPrice)}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            Service-level target: {Math.round(recommendation.serviceLevelTarget * 100)}%
          </span>
        </div>

        {recommendation.material.materialId === "500-14892" && (
          <RepairContextSignal materialId={recommendation.material.materialId} />
        )}

        {recommendation.oarColdStart && <OarColdStartPanel guidance={recommendation.oarColdStart} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartCard title="Current vs. recommended parameters" span={12}>
            <ParameterComparison current={recommendation.current} recommended={recommendation.recommended} />
          </ChartCard>

          <ChartCard
            title="Why is this recommended?"
            subtitle="Expected lead-time demand + safety buffer = recommended ROP"
            span={7}
          >
            <div className="flex flex-col gap-3">
              <WhyRecommended recommendation={recommendation} />
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                  Consumption history (last 6 months)
                </div>
                <ConsumptionHistoryChart data={recommendation.consumptionHistory} />
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="Champion vs. challenger model"
            subtitle="Which forecasting approach produced this recommendation"
            span={5}
          >
            <ChampionChallengerCards comparison={recommendation.championChallenger} />
          </ChartCard>

          <ChartCard
            title="Approval workflow"
            subtitle="End User → Engineering Manager → Commercial Manager → Warehouse Supervisor"
            span={12}
          >
            <ApprovalWorkflowPanel recommendation={recommendation} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
