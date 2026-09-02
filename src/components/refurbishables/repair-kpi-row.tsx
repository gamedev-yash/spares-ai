import { Banknote, ClipboardCheck, Timer, Wrench } from "lucide-react"

import {
  ATTESTATION_TARGET_PCT,
  REPAIR_LOOP_SUMMARY,
  isInRepairLoop,
  isOverdue,
  type RefurbishableItem,
} from "@/lib/refurbishables-data"
import { cn, formatCount, formatZARMillions } from "@/lib/utils"

function KpiCard({
  label,
  icon: Icon,
  figure,
  sub,
  tone = "default",
}: {
  label: string
  icon: typeof Wrench
  figure: string
  sub: string
  tone?: "default" | "warning" | "danger"
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
          tone === "default" && "text-foreground"
        )}
      >
        {figure}
      </div>
      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
        {sub}
      </div>
    </div>
  )
}

export function RepairKpiRow({ items }: { items: RefurbishableItem[] }) {
  const inLoop = items.filter(isInRepairLoop)
  const loopValue = inLoop.reduce((sum, item) => sum + item.valueZar, 0)
  const overdue = inLoop.filter(isOverdue).length
  const attested = items.filter((item) => item.attested).length
  const compliancePct = Math.round((attested / items.length) * 100)
  const belowTarget = compliancePct < ATTESTATION_TARGET_PCT
  const { avgTurnaroundDays, targetTurnaroundDays, loopsClosedLast12Months } =
    REPAIR_LOOP_SUMMARY

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="In repair loop"
        icon={Wrench}
        figure={formatCount(inLoop.length)}
        sub={`serialised items out of stock · ${formatCount(overdue)} past the 60-day flag`}
      />
      <KpiCard
        label="Value in repair loop"
        icon={Banknote}
        figure={formatZARMillions(loopValue / 1_000_000)}
        sub={`stock value sitting outside the storeroom across ${formatCount(inLoop.length)} items`}
      />
      <KpiCard
        label="Avg turnaround"
        icon={Timer}
        figure={`${avgTurnaroundDays}d`}
        sub={`removal → return over ${formatCount(loopsClosedLast12Months)} loops closed in 12 months · target ${targetTurnaroundDays}d`}
      />
      <KpiCard
        label="Attestation compliance"
        icon={ClipboardCheck}
        figure={`${compliancePct}%`}
        sub={
          belowTarget
            ? `${formatCount(items.length - attested)} removals un-attested · target ${ATTESTATION_TARGET_PCT}%`
            : `all ${formatCount(items.length)} removals declared · target ${ATTESTATION_TARGET_PCT}%`
        }
        tone={belowTarget ? "warning" : "default"}
      />
    </div>
  )
}
