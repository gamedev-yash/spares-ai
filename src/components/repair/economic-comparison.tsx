import { ArrowRight, Clock, Wrench } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { EconomicEvaluation } from "@/lib/api/repair"
import { cn, formatZAR } from "@/lib/utils"

const BASIS_LABEL: Record<string, string> = {
  OPEN_REPAIR_PO: "from the open repair order",
  OPEN_REPAIR_PR: "from the open repair requisition",
  ESTIMATED_FROM_MATERIAL_FACTOR: "estimated from the material's repair factor",
}

/**
 * Repair-in-flight vs. buying new. Every figure traces to a document in the data -- the
 * repair cost comes from the actual repair order wherever one exists. Presented as
 * information, not a recommendation: the decision stays with the requisitioner.
 */
export function EconomicComparison({
  economics,
  className,
}: {
  economics: EconomicEvaluation
  className?: string
}) {
  const saves = economics.saving_if_repair_used > 0

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <Wrench className="size-3.5" />
            Repair in progress
          </div>
          <p className="mt-1.5 text-lg font-semibold text-foreground">
            {formatZAR(economics.repair_total_cost)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {BASIS_LABEL[economics.repair_cost_basis] ?? economics.repair_cost_basis}
            {economics.repair_reference ? ` · ${economics.repair_reference}` : ""}
          </p>
          {economics.repair_expected_return && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs",
                economics.repair_is_overdue ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Clock className="size-3.5 shrink-0" />
              {economics.repair_is_overdue
                ? `Was due ${economics.repair_expected_return} — overdue`
                : `Back on ${economics.repair_expected_return}` +
                  (economics.repair_days_until_return != null
                    ? ` (${economics.repair_days_until_return} days)`
                    : "")}
            </p>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            <ArrowRight className="size-3.5" />
            Buy new instead
          </div>
          <p className="mt-1.5 text-lg font-semibold text-foreground">
            {formatZAR(economics.new_total_cost)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {economics.quantity}
            {economics.quantity === 1 ? " unit" : " units"} at {formatZAR(economics.new_unit_cost)}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {economics.new_lead_time_days} day lead time
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        {saves ? (
          <StatusBadge tone="success">
            Letting the repair finish avoids {formatZAR(economics.saving_if_repair_used)}
            {economics.saving_pct != null ? ` (${Math.round(economics.saving_pct)}%)` : ""}
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning">
            The repair is not cheaper than buying new
          </StatusBadge>
        )}
        {economics.repair_arrives_sooner ? (
          <StatusBadge tone="default">Repair arrives sooner</StatusBadge>
        ) : economics.repair_is_overdue ? (
          <StatusBadge tone="danger">Repair has missed its return date</StatusBadge>
        ) : (
          <StatusBadge tone="default">Buying new arrives sooner</StatusBadge>
        )}
      </div>
    </div>
  )
}
