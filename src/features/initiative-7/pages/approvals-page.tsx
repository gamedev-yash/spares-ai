import { PageHeader } from "@/components/shared/page-header"
import { ApprovalsQueueTable } from "@/features/initiative-7/components/approvals-queue-table"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"

export function InventoryApprovalQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Approval Queue"
          description="Recommendations awaiting sign-off across the approval chain."
        />
        <ApprovalsQueueTable recommendations={RECOMMENDATIONS} />
      </div>
    </div>
  )
}
