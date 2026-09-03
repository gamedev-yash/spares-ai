import { PageHeader } from "@/components/shared/page-header"
import { ApprovalsWorkspace } from "@/features/initiative-7/components/approvals-workspace"

export function InventoryApprovalQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          title="Approvals"
          description="Review, decide, and track inventory recommendations"
        />
        <ApprovalsWorkspace />
      </div>
    </div>
  )
}
