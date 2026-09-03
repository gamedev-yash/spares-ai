"use client"

import { Fragment, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
} from "lucide-react"

import { RecommendationDetail } from "@/components/inventory-optimization/recommendation-detail"
import { SegmentBadge } from "@/components/inventory-optimization/segment-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  isStockOutRisk,
  stockOutRiskTier,
  workingCapitalDeltaPct,
  workingCapitalDeltaZar,
  type InventoryPlant,
  type InventorySegment,
  type ParameterRecommendation,
  type RecommendationDecision,
  type RecommendationStatus,
  type StockoutRiskTier,
} from "@/lib/inventory-optimization-data"
import { formatCount, formatZAR } from "@/lib/utils"

const ALL_FILTER = "all"
const PLANTS: InventoryPlant[] = ["Gamsberg", "BMM"]
const SEGMENTS: InventorySegment[] = ["A-X", "B-X", "C-Y", "Z"]

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "excluded", label: "Excluded (Z)" },
] as const

type TabKey = (typeof TABS)[number]["key"]

const STATUS_TONE: Record<
  RecommendationStatus,
  "default" | "success" | "warning" | "danger"
> = {
  "Pending review": "warning",
  Approved: "success",
  Rejected: "danger",
  "Excluded — engineering review": "default",
}

const TAB_STATUS: Record<Exclude<TabKey, "all">, RecommendationStatus> = {
  pending: "Pending review",
  approved: "Approved",
  excluded: "Excluded — engineering review",
}

export type SessionDecisions = Record<
  string,
  { decision: RecommendationDecision; comment: string }
>

const STOCKOUT_RISK_TONE: Record<StockoutRiskTier, "success" | "warning" | "danger"> = {
  Critical: "danger",
  Moderate: "warning",
  Low: "success",
}

function StockoutRiskCell({
  recommendation,
}: {
  recommendation: ParameterRecommendation
}) {
  const tier = stockOutRiskTier(recommendation)
  if (!tier) {
    return <span className="text-muted-foreground">—</span>
  }
  return <StatusBadge tone={STOCKOUT_RISK_TONE[tier]}>{tier}</StatusBadge>
}

/**
 * Working-capital impact of the safety-stock change. Colour tracks direction,
 * not "good": down releases capital, up buys risk cover, both legitimate.
 */
function ValueChangeCell({
  recommendation,
}: {
  recommendation: ParameterRecommendation
}) {
  if (!recommendation.recommended) {
    return <span className="text-muted-foreground">—</span>
  }

  const delta = workingCapitalDeltaZar(recommendation)
  if (delta === 0) {
    return <span className="text-muted-foreground">no change</span>
  }

  const pct = workingCapitalDeltaPct(recommendation)
  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp
  const tone = delta < 0 ? "text-success" : "text-warning"

  return (
    <div
      className={`flex items-center justify-end gap-1 font-medium tabular-nums ${tone}`}
    >
      <DeltaIcon className="size-3 shrink-0" />
      {formatZAR(Math.abs(delta))}
      <span className="text-muted-foreground font-normal">
        ({pct > 0 ? "+" : ""}
        {pct}%)
      </span>
    </div>
  )
}

function RopChangeCell({
  recommendation,
}: {
  recommendation: ParameterRecommendation
}) {
  if (!recommendation.recommended) {
    return <span className="text-muted-foreground">—</span>
  }

  const delta = recommendation.recommended.rop - recommendation.current.rop
  if (delta === 0) {
    return <span className="text-muted-foreground">no change</span>
  }

  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp
  const tone = delta < 0 ? "text-success" : "text-warning"

  return (
    <div
      className={`flex items-center justify-end gap-1 font-medium tabular-nums ${tone}`}
    >
      <DeltaIcon className="size-3 shrink-0" />
      {formatCount(Math.abs(delta))} units
    </div>
  )
}

function ConfidenceCell({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-foreground">{confidence}%</span>
    </div>
  )
}

const STATUS_LABEL: Partial<Record<RecommendationStatus, string>> = {
  "Pending review": "Needs review",
}

function StatusCell({ status }: { status: RecommendationStatus }) {
  const excluded = status === "Excluded — engineering review"
  return (
    <div>
      <StatusBadge tone={STATUS_TONE[status]}>
        {excluded ? "Excluded" : (STATUS_LABEL[status] ?? status)}
      </StatusBadge>
      {excluded && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Engineering review
        </div>
      )}
    </div>
  )
}

function RecommendationRow({
  recommendation,
  status,
  isExpanded,
  onToggle,
  sessionDecision,
  onDecide,
  columnCount,
}: {
  recommendation: ParameterRecommendation
  status: RecommendationStatus
  isExpanded: boolean
  onToggle: () => void
  sessionDecision?: { decision: RecommendationDecision; comment: string }
  onDecide: (decision: RecommendationDecision, comment: string) => void
  columnCount: number
}) {
  const atRisk = isStockOutRisk(recommendation)

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            {recommendation.materialId}
            {atRisk && (
              <TriangleAlert
                className="size-3.5 shrink-0 text-warning"
                aria-label="Flagged for stock-out risk"
              />
            )}
          </div>
          <div className="max-w-[240px] truncate text-[11px] text-muted-foreground">
            {recommendation.description} · {recommendation.manufacturer}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {recommendation.plant}
        </TableCell>
        <TableCell>
          <SegmentBadge segment={recommendation.segment} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {recommendation.circuit}
        </TableCell>
        <TableCell>
          <StockoutRiskCell recommendation={recommendation} />
        </TableCell>
        <TableCell className="text-right">
          <ValueChangeCell recommendation={recommendation} />
        </TableCell>
        <TableCell className="text-right">
          <RopChangeCell recommendation={recommendation} />
        </TableCell>
        <TableCell>
          <ConfidenceCell confidence={recommendation.confidence} />
        </TableCell>
        <TableCell>
          <StatusCell status={status} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell />
          <TableCell colSpan={columnCount - 1} className="bg-muted/30 py-4 whitespace-normal">
            <RecommendationDetail
              recommendation={recommendation}
              sessionDecision={sessionDecision}
              onDecide={onDecide}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

const COLUMN_COUNT = 10

export function RecommendationWorkbench({
  recommendations,
  decisions,
  onDecide,
}: {
  recommendations: ParameterRecommendation[]
  decisions: SessionDecisions
  onDecide: (
    recommendation: ParameterRecommendation,
    decision: RecommendationDecision,
    comment: string
  ) => void
}) {
  const [tab, setTab] = useState<TabKey>("all")
  const [plant, setPlant] = useState<InventoryPlant | typeof ALL_FILTER>(ALL_FILTER)
  const [segment, setSegment] = useState<InventorySegment | typeof ALL_FILTER>(
    ALL_FILTER
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /** A session decision overrides the authored status. */
  const statusOf = useMemo(() => {
    return (recommendation: ParameterRecommendation): RecommendationStatus =>
      decisions[recommendation.id]?.decision ?? recommendation.status
  }, [decisions])

  const filtered = useMemo(
    () =>
      recommendations.filter((recommendation) => {
        if (plant !== ALL_FILTER && recommendation.plant !== plant) return false
        if (segment !== ALL_FILTER && recommendation.segment !== segment)
          return false
        return true
      }),
    [recommendations, plant, segment]
  )

  const rowsFor = (key: TabKey) =>
    key === "all"
      ? filtered
      : filtered.filter((r) => statusOf(r) === TAB_STATUS[key])

  const counts: Record<TabKey, number> = {
    all: filtered.length,
    pending: rowsFor("pending").length,
    approved: rowsFor("approved").length,
    excluded: rowsFor("excluded").length,
  }

  function renderTable(rows: ParameterRecommendation[]) {
    if (rows.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No recommendations match these filters.
        </div>
      )
    }

    // Rejected proposals are not going anywhere, so they are left out of the
    // net figure — it answers "what do the live proposals here add up to".
    const netImpact = rows
      .filter((r) => statusOf(r) !== "Rejected")
      .reduce((sum, r) => sum + workingCapitalDeltaZar(r), 0)

    return (
      <div className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Circuit</TableHead>
              <TableHead>Stockout risk</TableHead>
              <TableHead className="text-right">Value change</TableHead>
              <TableHead className="text-right">ROP change</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((recommendation) => (
              <RecommendationRow
                key={recommendation.id}
                recommendation={recommendation}
                status={statusOf(recommendation)}
                isExpanded={expandedId === recommendation.id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === recommendation.id ? null : recommendation.id
                  )
                }
                sessionDecision={decisions[recommendation.id]}
                onDecide={(decision, comment) =>
                  onDecide(recommendation, decision, comment)
                }
                columnCount={COLUMN_COUNT}
              />
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Showing {rows.length} of {recommendations.length} materials · click a
            row for the forecast and rationale
          </span>
          <span>
            Net working-capital impact of live proposals shown:{" "}
            <span
              className={
                netImpact < 0
                  ? "font-medium text-success"
                  : netImpact > 0
                    ? "font-medium text-warning"
                    : "font-medium text-foreground"
              }
            >
              {netImpact < 0 ? "−" : netImpact > 0 ? "+" : ""}
              {formatZAR(Math.abs(netImpact))}
            </span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={plant}
          onValueChange={(value) =>
            setPlant((value ?? ALL_FILTER) as InventoryPlant | typeof ALL_FILTER)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Plant">
              {(value: string) => (value === ALL_FILTER ? "All plants" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plants</SelectItem>
            {PLANTS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={segment}
          onValueChange={(value) =>
            setSegment(
              (value ?? ALL_FILTER) as InventorySegment | typeof ALL_FILTER
            )
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Segment">
              {(value: string) =>
                value === ALL_FILTER ? "All segments" : `Segment ${value}`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All segments</SelectItem>
            {SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>
                Segment {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent px-0 py-0"
        >
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="px-0.5 py-2.5 text-sm">
              {t.label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {counts[t.key]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Panels share one grid cell so a panel stuck mid-exit-transition
            overlaps instead of pushing the page to double height. */}
        <div className="grid">
          {TABS.map((t) => (
            <TabsContent
              key={t.key}
              value={t.key}
              className="col-start-1 row-start-1 pt-4 data-ending-style:invisible data-ending-style:pointer-events-none"
            >
              {renderTable(rowsFor(t.key))}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
