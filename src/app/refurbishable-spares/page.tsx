import type { Metadata } from "next"

import { RefurbishableSparesOverviewPage } from "@/features/initiative-8/pages/overview-page"

export const metadata: Metadata = {
  title: "Refurbishable Spares — Spares AI",
}

export default function Page() {
  return <RefurbishableSparesOverviewPage />
}
