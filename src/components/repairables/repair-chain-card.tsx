import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { AgingCell } from "@/components/shared/aging-cell"
import { StatusBadge } from "@/components/shared/status-badge"
import type { RepairChain } from "@/lib/types"

const STATUS_TONE: Record<
  RepairChain["status"],
  "default" | "success" | "danger"
> = {
  Open: "default",
  Overdue: "danger",
  Received: "success",
}

export function RepairChainCard({ chain }: { chain: RepairChain }) {
  return (
    <DashboardCard title={chain.document.docNumber} subtitle={chain.vendor}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <StatusBadge tone={STATUS_TONE[chain.status]}>
            {chain.status}
          </StatusBadge>
          <AgingCell days={chain.daysOpen} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="text-muted-foreground">Dispatched</div>
          <div className="text-right text-foreground">
            {chain.dispatchDate}
          </div>
          <div className="text-muted-foreground">Expected return</div>
          <div className="text-right text-foreground">
            {chain.expectedDelivery}
          </div>
          <div className="text-muted-foreground">Quantity out</div>
          <div className="text-right text-foreground">{chain.quantityOut}</div>
          <div className="text-muted-foreground">Received</div>
          <div className="text-right text-foreground">
            {chain.receivedQuantity}
          </div>
          <div className="font-medium text-muted-foreground">
            Still under repair
          </div>
          <div className="text-right font-medium text-foreground">
            {chain.quantityUnderRepair}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
