import { TriangleAlert } from "lucide-react"

import type { RepairChain } from "@/lib/types"

export function DuplicateGuardAlert({ chains }: { chains: RepairChain[] }) {
  const active = chains.filter((c) => c.quantityUnderRepair > 0)
  if (active.length === 0) return null

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <div className="font-medium text-foreground">
          {active.length === 1
            ? "A repair chain is"
            : `${active.length} repair chains are`}{" "}
          already open for this material
        </div>
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {active.map((chain) => (
            <li key={chain.id}>
              {chain.document.docNumber} — {chain.quantityUnderRepair} of{" "}
              {chain.quantityOut} units still at {chain.vendor}, expected{" "}
              {chain.expectedDelivery}
              {chain.status === "Overdue" && (
                <span className="ml-1 font-medium text-destructive">
                  (overdue)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
