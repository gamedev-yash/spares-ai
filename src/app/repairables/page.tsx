import type { Metadata } from "next"

import { RepairKpis } from "@/components/repairables/repair-kpis"
import { RepairRegisterTable } from "@/components/repairables/repair-register-table"
import { AdvisoryNotice } from "@/components/shared/advisory-notice"
import { PageHeader } from "@/components/shared/page-header"
import { getRepairKpiSummary, getRepairRegister } from "@/lib/repairables-data"

export const metadata: Metadata = {
  title: "Repair register — Spares AI",
}

export default function RepairablesPage() {
  const register = getRepairRegister()
  const summary = getRepairKpiSummary()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <PageHeader
          eyebrow="Module: Initiative 8"
          title="Repair register"
          description="Every item currently out for repair, across both plants."
        />
        <RepairKpis summary={summary} />
        <AdvisoryNotice kind="not-a-block" />
        <RepairRegisterTable rows={register} />
      </div>
    </div>
  )
}
