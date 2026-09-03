import type { Metadata } from "next"

import { InventoryMonitoringPage } from "@/features/initiative-7/pages/monitoring-page"

export const metadata: Metadata = {
  title: "Monitoring — Inventory Optimization — Spares AI",
}

export default function Page() {
  return <InventoryMonitoringPage />
}
