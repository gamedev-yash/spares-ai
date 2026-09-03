import type { Metadata } from "next"

import { InventoryApprovalQueuePage } from "@/features/initiative-7/pages/approvals-page"

export const metadata: Metadata = {
  title: "Approvals — Inventory Optimization — Spares AI",
}

export default function Page() {
  return <InventoryApprovalQueuePage />
}
