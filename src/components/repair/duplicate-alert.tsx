import { TriangleAlert } from "lucide-react"

import { EconomicComparison } from "@/components/repair/economic-comparison"
import { StatusBadge } from "@/components/shared/status-badge"
import type { DuplicateContext, EconomicEvaluation, RepairChain } from "@/lib/api/repair"
import { cn } from "@/lib/utils"

/**
 * Initiative 8 Layer 1 -- the advisory duplicate warning.
 *
 * This never blocks anything. It states what is already in flight so the requisitioner (or
 * the approver reading it later) decides knowingly. A genuine second failure of the same
 * part is legitimate, which is exactly why this warns rather than refuses.
 */
export function DuplicateAlert({
  chains,
  economics,
  heading = "A repair for this material is already in progress",
  compact = false,
  className,
}: {
  chains: RepairChain[]
  economics?: EconomicEvaluation | null
  heading?: string
  compact?: boolean
  className?: string
}) {
  if (chains.length === 0) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-warning/40 bg-warning/5 p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{heading}</p>

          <ul className="mt-2 flex flex-col gap-2">
            {chains.map((chain, i) => (
              <li
                key={`${chain.repair_po_number ?? chain.repair_pr_number ?? i}`}
                className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">
                    {chain.repair_po_number ?? chain.repair_pr_number ?? "Repair document"}
                  </span>
                  {chain.overdue ? (
                    <StatusBadge tone="danger">{chain.days_overdue}d overdue</StatusBadge>
                  ) : chain.expected_return ? (
                    <StatusBadge tone="default">Back {chain.expected_return}</StatusBadge>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {chain.quantity_under_repair}
                  {chain.quantity_under_repair === 1 ? " unit" : " units"} of{" "}
                  <span className="text-foreground">{chain.material_code}</span>
                  {chain.vendor ? ` at ${chain.vendor}` : " awaiting dispatch to a vendor"}
                  {chain.days_open != null ? ` · open ${chain.days_open} days` : ""}
                </p>
              </li>
            ))}
          </ul>

          {economics && !compact && (
            <EconomicComparison economics={economics} className="mt-2.5" />
          )}

          {!compact && (
            <p className="mt-2.5 text-xs text-muted-foreground">
              You can still raise this requisition — a second failure of the same part is a
              legitimate reason. It will be flagged so the approver sees this context.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Renders the stored context from a flagged requisition (approvals list, audit views). */
export function DuplicateContextAlert({
  context,
  compact = true,
  className,
}: {
  context: DuplicateContext
  compact?: boolean
  className?: string
}) {
  const chains = context.materials?.flatMap((m) => m.chains ?? []) ?? []
  if (chains.length === 0) return null
  return (
    <DuplicateAlert
      chains={chains}
      compact={compact}
      className={className}
      heading="Raised while a repair was already in progress"
    />
  )
}
