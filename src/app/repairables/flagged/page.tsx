import type { Metadata } from "next"

import { FlaggedPrQueue } from "@/components/repairables/flagged-pr-queue"
import { PageHeader } from "@/components/shared/page-header"
import { getFlaggedPrs } from "@/lib/repairables-data"

export const metadata: Metadata = {
  title: "Flagged PRs — Spares AI",
}

export default function FlaggedPrsPage() {
  const rows = getFlaggedPrs()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PageHeader
          eyebrow="Repairables"
          title="Flagged PRs"
          description="New procurement requests the guard flagged as colliding with an open repair chain."
        />
        <FlaggedPrQueue rows={rows} />
      </div>
    </div>
  )
}
