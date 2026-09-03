import type { ReactNode } from "react"

import { InventoryWorkflowProvider } from "@/features/initiative-7/context/workflow-context"

/** Approval state is shared across every Inventory Optimization screen, so a
 * recommendation sent for approval on one page is visible in the queue and
 * the pipeline on the others. */
export default function InventoryOptimizationLayout({ children }: { children: ReactNode }) {
  return <InventoryWorkflowProvider>{children}</InventoryWorkflowProvider>
}
