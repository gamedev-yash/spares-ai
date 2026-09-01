import { StatusBadge } from "@/components/shared/status-badge"
import type {
  ChangeProposalBatch,
  ProposalStatus,
} from "@/lib/inventory-optimization-data"
import { formatCount, formatZAR } from "@/lib/utils"

const STATUS_TONE: Record<ProposalStatus, "warning" | "default"> = {
  Draft: "warning",
  "Submitted to SAP team": "default",
}

function ValueImpact({ amount }: { amount: number }) {
  const released = amount < 0
  return (
    <span
      className={`text-sm font-medium tabular-nums ${
        released ? "text-success" : "text-warning"
      }`}
    >
      {released ? "−" : "+"}
      {formatZAR(Math.abs(amount))}
    </span>
  )
}

export function ChangeProposalExport({
  batches,
  sessionApprovedCount,
  sessionApprovedValueZar,
}: {
  batches: ChangeProposalBatch[]
  /** Rows approved in this browser session, folded into the open draft batch. */
  sessionApprovedCount: number
  sessionApprovedValueZar: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {batches.map((batch) => {
          const isOpenDraft = batch.status === "Draft"
          const itemCount = isOpenDraft
            ? batch.itemCount + sessionApprovedCount
            : batch.itemCount
          const valueImpact = isOpenDraft
            ? batch.valueImpactZar + sessionApprovedValueZar
            : batch.valueImpactZar

          return (
            <li
              key={batch.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-[7.5rem]">
                <div className="text-sm font-medium text-foreground">
                  {batch.id}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Raised {batch.raisedOn}
                  {batch.submittedOn && ` · submitted ${batch.submittedOn}`}
                </div>
              </div>

              <StatusBadge tone={STATUS_TONE[batch.status]}>
                {batch.status}
              </StatusBadge>

              <div className="text-sm text-foreground">
                <span className="font-medium tabular-nums">
                  {formatCount(itemCount)}
                </span>{" "}
                <span className="text-muted-foreground">items</span>
                {isOpenDraft && sessionApprovedCount > 0 && (
                  <span className="ml-1 text-[11px] font-medium text-success">
                    +{sessionApprovedCount} this session
                  </span>
                )}
              </div>

              <ValueImpact amount={valueImpact} />

              <p className="min-w-[16rem] flex-1 text-[11px] leading-snug text-muted-foreground">
                {batch.note}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="border-t border-dashed border-border pt-3 text-[11px] leading-relaxed text-muted-foreground italic">
        Platform is advisory — parameter changes are applied in SAP via governed
        mass maintenance with change-document audit trail. No direct SAP
        write-back.
      </p>
    </div>
  )
}
