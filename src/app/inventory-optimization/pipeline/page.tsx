import type { Metadata } from "next"

import { InventoryPipelinePage } from "@/features/initiative-7/pages/pipeline-page"

export const metadata: Metadata = {
  title: "Pipeline — Inventory Optimization — Spares AI",
}

export default function Page() {
  return <InventoryPipelinePage />
}
