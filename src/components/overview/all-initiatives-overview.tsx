import { AttentionRequiredPanel } from "@/components/overview/attention-required-panel"
import { InitiativeSummaryCard } from "@/components/overview/initiative-summary-card"
import { MaterialRiskLandscape } from "@/components/overview/material-risk-landscape"
import { RecentEventsFeed } from "@/components/overview/recent-events-feed"
import {
  getAllAuditEvents,
  getAllGlobalActions,
  getAllInitiativeSummaries,
} from "@/lib/aggregation"
import { MATERIALS } from "@/lib/shared-data/material-catalog"

/**
 * The "All" tab of the Spares Control Tower — the cross-module bird's-eye
 * view (summary cards, aggregated attention/risk/events). Pure composition
 * over data each initiative already computes; no business logic lives here.
 */
export function AllInitiativesOverview() {
  const summaries = getAllInitiativeSummaries()
  const actions = getAllGlobalActions()
  const events = getAllAuditEvents()

  const [, initiative8, initiative13] = summaries
  const lowStockMaterials = [...MATERIALS]
    .sort((a, b) => a.stockLevel - b.stockLevel)
    .slice(0, 5)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summaries.map((summary) => (
            <InitiativeSummaryCard key={summary.id} summary={summary} />
          ))}
        </div>

        <AttentionRequiredPanel actions={actions} />

        <MaterialRiskLandscape
          lowStockMaterials={lowStockMaterials}
          initiative8Summary={initiative8}
          initiative13Summary={initiative13}
        />

        <RecentEventsFeed events={events} />
      </div>
    </div>
  )
}
