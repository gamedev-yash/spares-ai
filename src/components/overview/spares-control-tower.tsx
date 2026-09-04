import { OverviewTabs } from "@/components/overview/overview-tabs"
import { PageHeader } from "@/components/shared/page-header"

/**
 * The Spares Control Tower — the single "Overview" surface in the app.
 * Per-module Overview pages don't have their own sidebar entry or route
 * anymore; they render here as tabs (see `overview-tabs.tsx`) so there is
 * exactly one "Overview" concept instead of four.
 */
export function SparesControlTower() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-6 pt-6 pb-4">
        <PageHeader
          title="Spares Control Tower"
          description="Enterprise view across inventory optimization, refurbishable spares and OAR utilization."
        />
      </div>
      <OverviewTabs />
    </div>
  )
}
