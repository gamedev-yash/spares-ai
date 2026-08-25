import { TwoSidedComparison } from "@/components/shared/two-sided-comparison"
import type { RepairVsNewEvaluation } from "@/lib/types"
import { formatZAR } from "@/lib/utils"

export function RepairVsNewComparison({
  evaluation,
}: {
  evaluation: RepairVsNewEvaluation
}) {
  const repairIsWinner = evaluation.recommendation === "repair"
  const newIsWinner = evaluation.recommendation === "new"
  const remainingLabel =
    evaluation.repairRemainingDays < 0
      ? `${Math.abs(evaluation.repairRemainingDays)} days overdue`
      : `${evaluation.repairRemainingDays} days remaining`

  return (
    <TwoSidedComparison
      heading="Repair vs. new unit"
      left={{
        label: "Repair (in progress)",
        title: remainingLabel,
        subtitle: `Expected back ${evaluation.repairExpectedReturn}`,
        primaryValue: formatZAR(evaluation.repairCost),
        primaryTone: repairIsWinner ? "success" : "default",
        highlight: repairIsWinner,
      }}
      right={{
        label: "New unit",
        title: `${evaluation.newUnitLeadDays}-day lead time`,
        primaryValue: formatZAR(evaluation.newUnitPrice),
        primaryTone: newIsWinner ? "success" : "default",
        highlight: newIsWinner,
      }}
      banner={{
        text: evaluation.rationale,
        tone: evaluation.recommendation === "either" ? "warning" : "default",
      }}
    />
  )
}
