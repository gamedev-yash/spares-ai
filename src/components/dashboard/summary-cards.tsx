import { ClipboardCheck, Lightbulb, MessageCircle, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { DashboardSummary } from "@/lib/types"
import { formatZAR } from "@/lib/utils"

const CARDS: {
  key: keyof DashboardSummary
  label: string
  icon: LucideIcon
  format: (value: number) => string
}[] = [
  {
    key: "activeSessions",
    label: "Active sessions",
    icon: MessageCircle,
    format: (v) => String(v),
  },
  {
    key: "alternatesFoundThisMonth",
    label: "Alternates found this month",
    icon: Lightbulb,
    format: (v) => String(v),
  },
  {
    key: "costSavingsZAR",
    label: "Cost savings (6 months)",
    icon: TrendingUp,
    format: formatZAR,
  },
  {
    key: "pendingApprovals",
    label: "Pending approvals",
    icon: ClipboardCheck,
    format: (v) => String(v),
  },
]

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <card.icon className="size-3.5" />
            {card.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {card.format(summary[card.key])}
          </div>
        </div>
      ))}
    </div>
  )
}
