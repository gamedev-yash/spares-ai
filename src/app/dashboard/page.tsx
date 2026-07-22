import type { Metadata } from "next"

import { CategoryChart } from "@/components/dashboard/category-chart"
import { SavingsChart } from "@/components/dashboard/savings-chart"
import { SessionsTable } from "@/components/dashboard/sessions-table"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import {
  CATEGORY_BREAKDOWN,
  CHAT_SESSIONS,
  SAVINGS_TREND,
  getDashboardSummary,
} from "@/lib/mock-data"

export const metadata: Metadata = {
  title: "Dashboard — Spares AI",
}

export default function DashboardPage() {
  const summary = getDashboardSummary()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Procurement activity across all active sessions.
          </p>
        </div>

        <SummaryCards summary={summary} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
            <h2 className="text-sm font-medium text-foreground">
              Cost savings trend
            </h2>
            <p className="text-xs text-muted-foreground">Last 6 months, ZAR</p>
            <div className="mt-2">
              <SavingsChart data={SAVINGS_TREND} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-foreground">
              Alternates by category
            </h2>
            <p className="text-xs text-muted-foreground">This month</p>
            <div className="mt-2">
              <CategoryChart data={CATEGORY_BREAKDOWN} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Recent sessions
          </h2>
          <SessionsTable sessions={CHAT_SESSIONS} />
        </div>
      </div>
    </div>
  )
}
