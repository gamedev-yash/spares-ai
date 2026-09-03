"use client"

import { useId, useState } from "react"
import { ArrowDown, ArrowUp, Check, Info, ShieldAlert, X } from "lucide-react"

import { ConsumptionForecastChart } from "@/components/inventory-optimization/consumption-forecast-chart"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  buildConsumptionSeries,
  meanMonthlyConsumption,
  workingCapitalDeltaZar,
  type ParameterRecommendation,
  type RecommendationDecision,
} from "@/lib/inventory-optimization-data"
import { formatCount, formatZAR } from "@/lib/utils"

/**
 * Current vs recommended for one SAP parameter. Colour tracks the direction of
 * the change, not whether it is "good": down releases working capital, up buys
 * risk cover, and both are legitimate outcomes.
 */
function ParameterStatBox({
  label,
  current,
  recommended,
  unitOfMeasure,
}: {
  label: string
  current: number
  recommended: number | undefined
  unitOfMeasure: string
}) {
  if (recommended === undefined) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          {label}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {formatCount(current)} {unitOfMeasure}
        </div>
      </div>
    )
  }

  const delta = recommended - current
  const pct = current === 0 ? 0 : Math.round((delta / current) * 100)
  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp
  const tone =
    delta < 0 ? "text-success" : delta > 0 ? "text-warning" : "text-muted-foreground"

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium tabular-nums text-foreground">
        {formatCount(current)} → {formatCount(recommended)} {unitOfMeasure}
      </div>
      {delta === 0 ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">no change</div>
      ) : (
        <div
          className={`mt-0.5 flex items-center gap-0.5 text-[11px] font-medium ${tone}`}
        >
          <DeltaIcon className="size-3 shrink-0" />
          {formatCount(Math.abs(delta))} ({pct > 0 ? "+" : ""}
          {pct}%)
        </div>
      )}
    </div>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

function DecisionForm({
  onDecide,
}: {
  onDecide: (decision: RecommendationDecision, comment: string) => void
}) {
  const [comment, setComment] = useState("")
  const commentId = useId()
  const hintId = useId()
  const canDecide = comment.trim().length > 0

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <label
        htmlFor={commentId}
        className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
      >
        Planner comment (required)
      </label>
      <textarea
        id={commentId}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        aria-describedby={hintId}
        aria-required="true"
        rows={3}
        placeholder="Record the reasoning that will travel with the change document…"
        className="mt-1.5 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <p id={hintId} className="mt-1.5 text-[11px] text-muted-foreground">
        A comment is mandatory — it is carried into the SAP change document as
        the justification for the parameter change.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!canDecide}
          className="border-success/40 text-success hover:bg-success/10"
          onClick={() => onDecide("Approved", comment.trim())}
        >
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!canDecide}
          onClick={() => onDecide("Rejected", comment.trim())}
        >
          <X className="size-3.5" />
          Reject
        </Button>
        {!canDecide && (
          <span className="text-[11px] text-muted-foreground">
            Add a comment to enable the decision.
          </span>
        )}
      </div>
    </div>
  )
}

export function RecommendationDetail({
  recommendation,
  sessionDecision,
  onDecide,
}: {
  recommendation: ParameterRecommendation
  sessionDecision?: { decision: RecommendationDecision; comment: string }
  onDecide: (decision: RecommendationDecision, comment: string) => void
}) {
  const {
    current,
    recommended,
    leadTime,
    unitOfMeasure,
    exclusionReason,
    rationale,
  } = recommendation

  const series = buildConsumptionSeries(recommendation)
  const capitalDelta = workingCapitalDeltaZar(recommendation)
  const leadTimeOverrun = leadTime.actualDays > leadTime.plannedDays
  const decidedBeforeCycle =
    !sessionDecision &&
    (recommendation.status === "Approved" || recommendation.status === "Rejected")

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Recommended inventory
          </h4>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <ParameterStatBox
              label="Reorder point"
              current={current.rop}
              recommended={recommended?.rop}
              unitOfMeasure={unitOfMeasure}
            />
            <ParameterStatBox
              label="Safety stock"
              current={current.safetyStock}
              recommended={recommended?.safetyStock}
              unitOfMeasure={unitOfMeasure}
            />
            <ParameterStatBox
              label="Max stock"
              current={current.maxStock}
              recommended={recommended?.maxStock}
              unitOfMeasure={unitOfMeasure}
            />
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Consumption history &amp; forecast
          </h4>
          <p className="mt-0.5 mb-1 text-[11px] text-muted-foreground">
            24 months of actuals to Aug 2026, then a six-month seasonal projection.
          </p>
          <ConsumptionForecastChart
            series={series}
            current={current}
            recommended={recommended}
            unitOfMeasure={unitOfMeasure}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Why
          </h4>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
            {rationale.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-3 sm:grid-cols-3">
          <Fact label="MRP type (I11)">{recommendation.mrpType}</Fact>
          <Fact label="Lead time">
            <span className="text-muted-foreground">
              {leadTime.plannedDays}d planned
            </span>{" "}
            <span
              className={
                leadTimeOverrun ? "font-medium text-warning" : "font-medium text-success"
              }
            >
              {leadTime.actualDays}d actual
            </span>
          </Fact>
          <Fact label="Service level">
            {recommendation.serviceLevelTargetPct}% target
          </Fact>
          <Fact label="Mean draw (12m)">
            {meanMonthlyConsumption(recommendation)} {unitOfMeasure}/mo
          </Fact>
          <Fact label="Stock-outs (24m)">
            <span
              className={
                recommendation.stockOuts24m > 0
                  ? "font-medium text-destructive"
                  : undefined
              }
            >
              {formatCount(recommendation.stockOuts24m)}
            </span>
          </Fact>
          <Fact label="Unit cost">{formatZAR(recommendation.unitCostZar)}</Fact>
          <Fact label="Working capital">
            {recommended ? (
              <span
                className={
                  capitalDelta < 0
                    ? "font-medium text-success"
                    : capitalDelta > 0
                      ? "font-medium text-warning"
                      : undefined
                }
              >
                {capitalDelta < 0 ? "−" : capitalDelta > 0 ? "+" : ""}
                {formatZAR(Math.abs(capitalDelta))}
                {capitalDelta < 0 ? " released" : capitalDelta > 0 ? " tied up" : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">No proposal</span>
            )}
          </Fact>
        </dl>

        {exclusionReason ? (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] leading-relaxed text-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <div className="font-medium">Excluded from automatic proposals</div>
              <p className="mt-0.5 text-muted-foreground">{exclusionReason}</p>
            </div>
          </div>
        ) : sessionDecision ? (
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <StatusBadge
                tone={sessionDecision.decision === "Approved" ? "success" : "danger"}
              >
                {sessionDecision.decision}
              </StatusBadge>
              <span className="text-[11px] text-muted-foreground">
                recorded in this review session
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">
              “{sessionDecision.comment}”
            </p>
          </div>
        ) : decidedBeforeCycle ? (
          <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Decision already recorded earlier in this review cycle — the comment
              sits on the change document in SAP.
            </span>
          </div>
        ) : (
          <DecisionForm onDecide={onDecide} />
        )}
      </div>
    </div>
  )
}
