// Initiative 07 — Predictive Inventory & Safety Stock Optimization.
//
// I07 is the ML layer that sits ON TOP of the Initiative 11 rule-based SAP
// consumption-planning baseline (MRP types VB/V2, reorder point, safety
// stock, max stock, lot-sizing). It reads consumption history and lead-time
// actuals and RECOMMENDS revised parameters. It never writes to SAP:
// approved recommendations are batched into a governed change proposal that
// is executed through the SAP mass-maintenance process, with the change
// document providing the audit trail.
//
// Z-segment materials (erratic demand and insurance spares) are deliberately
// excluded from automatic proposals — their `recommended` block is null and
// they route to engineering review instead.
//
// Types live here rather than in lib/types.ts: nothing outside this
// initiative consumes them.

export type InventoryPlant = "Gamsberg" | "BMM"

/** ABC (value) x XYZ (demand variability). Z = erratic / insurance spare. */
export type InventorySegment = "A-X" | "B-X" | "C-Y" | "Z"

export type RecommendationStatus =
  | "Pending review"
  | "Approved"
  | "Rejected"
  | "Excluded — engineering review"

/** A planner decision that can be taken in the workbench (Z rows cannot be decided). */
export type RecommendationDecision = "Approved" | "Rejected"

/** The three SAP planning parameters I07 proposes revisions to. */
export interface ParameterSet {
  rop: number
  safetyStock: number
  maxStock: number
}

export interface ParameterRecommendation {
  id: string
  materialId: string
  description: string
  manufacturer: string
  plant: InventoryPlant
  segment: InventorySegment
  /** SAP MRP type from the I11 baseline — VB = manual reorder point, V2 = forecast-based. */
  mrpType: "VB" | "V2"
  unitOfMeasure: "EA" | "SET" | "M"
  unitCostZar: number
  current: ParameterSet
  /** null for Z-segment materials — no automatic proposal is generated. */
  recommended: ParameterSet | null
  /** null where no proposal was generated. */
  confidence: number | null
  status: RecommendationStatus
  leadTime: { plannedDays: number; actualDays: number }
  serviceLevelTargetPct: number
  stockOuts24m: number
  /** 24 monthly consumption actuals, oldest first — see SERIES_START. */
  consumption: number[]
  /** Fitted year-on-year growth applied to the seasonal-naive projection. */
  forecastGrowth: number
  /** Half-width of the forecast band, as a fraction of the projected value. */
  forecastBandPct: number
  rationale: string[]
  exclusionReason?: string
}

export interface ConsumptionPoint {
  /** Compact axis label, e.g. "Sep 24". */
  month: string
  /** Full label for tooltips, e.g. "Sep 2024". */
  monthLong: string
  actual: number | null
  forecast: number | null
  /** [low, high] — recharts renders a two-value dataKey as a range area. */
  band: [number, number] | null
}

export type ProposalStatus = "Draft" | "Submitted to SAP team"

export interface ChangeProposalBatch {
  id: string
  status: ProposalStatus
  itemCount: number
  /** Negative = working capital released. */
  valueImpactZar: number
  /** "DD MMM YYYY". */
  raisedOn: string
  submittedOn?: string
  note: string
}

export interface InventoryKpiSummary {
  materialsInScope: number
  /** ZAR Mn, across the full review scope — not just the sample below. */
  workingCapitalReleaseMn: number
  stockOutRiskItems: number
  mapePct: number
  /** Prior quarter's MAPE, for the trend indicator. */
  mapePriorPct: number
}

/** Snapshot the whole page is stated as of — everything here is a fixed extract. */
export const SNAPSHOT_DATE = "31 Aug 2026"

export const OPEN_PROPOSAL_ID = "CP-2026-014"

// ---------------------------------------------------------------------------
// Consumption series
//
// History runs Sep 2024 – Aug 2026 (24 months). The forecast is a
// seasonal-naive projection: the same month one year earlier scaled by the
// material's fitted growth factor, with a symmetric band. Deriving it rather
// than authoring it keeps the chart deterministic — it has to render
// identically on the server and on the client.
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Sep 2024 — month is 0-indexed. */
const SERIES_START = { year: 2024, month: 8 }

export const HISTORY_MONTHS = 24
export const FORECAST_MONTHS = 6

function monthLabels(offset: number): { short: string; long: string } {
  const absolute = SERIES_START.month + offset
  const year = SERIES_START.year + Math.floor(absolute / 12)
  const name = MONTH_NAMES[absolute % 12]
  return { short: `${name} ${String(year).slice(2)}`, long: `${name} ${year}` }
}

/**
 * History points followed by the projected band. The last actual month also
 * carries a `forecast` value so the two lines join instead of leaving a gap.
 */
export function buildConsumptionSeries(
  recommendation: ParameterRecommendation
): ConsumptionPoint[] {
  const { consumption, forecastGrowth, forecastBandPct } = recommendation
  const lastActualIndex = consumption.length - 1

  const history: ConsumptionPoint[] = consumption.map((value, index) => {
    const { short, long } = monthLabels(index)
    return {
      month: short,
      monthLong: long,
      actual: value,
      forecast: index === lastActualIndex ? value : null,
      band: index === lastActualIndex ? [value, value] : null,
    }
  })

  const forecast: ConsumptionPoint[] = Array.from(
    { length: FORECAST_MONTHS },
    (_, step) => {
      const { short, long } = monthLabels(HISTORY_MONTHS + step)
      // Same month last year, grown — index 12 is Sep 2025 for a Sep 2026 point.
      const seasonalBase = consumption[HISTORY_MONTHS - 12 + step]
      const projected = Math.round(seasonalBase * forecastGrowth)
      return {
        month: short,
        monthLong: long,
        actual: null,
        forecast: projected,
        band: [
          Math.max(0, Math.round(projected * (1 - forecastBandPct))),
          Math.round(projected * (1 + forecastBandPct)),
        ] as [number, number],
      }
    }
  )

  return [...history, ...forecast]
}

// ---------------------------------------------------------------------------
// Derived figures — computed, never authored, so a row cannot contradict itself
// ---------------------------------------------------------------------------

/** Working-capital movement of the safety-stock change. Negative = release. */
export function workingCapitalDeltaZar(
  recommendation: ParameterRecommendation
): number {
  if (!recommendation.recommended) return 0
  const delta =
    recommendation.recommended.safetyStock - recommendation.current.safetyStock
  return delta * recommendation.unitCostZar
}

/** A proposal that raises the reorder point is covering a stock-out exposure. */
export function isStockOutRisk(
  recommendation: ParameterRecommendation
): boolean {
  if (!recommendation.recommended) return false
  return recommendation.recommended.rop > recommendation.current.rop
}

export function meanMonthlyConsumption(
  recommendation: ParameterRecommendation,
  months = 12
): number {
  const window = recommendation.consumption.slice(-months)
  const total = window.reduce((sum, value) => sum + value, 0)
  return Math.round((total / window.length) * 10) / 10
}

// ---------------------------------------------------------------------------
// KPIs — scope-level figures for the full review population, of which the
// workbench below shows a 14-material sample.
// ---------------------------------------------------------------------------

export const INVENTORY_KPI: InventoryKpiSummary = {
  materialsInScope: 1284,
  workingCapitalReleaseMn: 42.6,
  stockOutRiskItems: 37,
  mapePct: 12.4,
  mapePriorPct: 16.1,
}

// ---------------------------------------------------------------------------
// Parameter recommendations
// ---------------------------------------------------------------------------

export const PARAMETER_RECOMMENDATIONS: ParameterRecommendation[] = [
  {
    id: "IOR-001",
    materialId: "500-22140",
    description: "Bearing, Spherical Roller, Conveyor Idler",
    manufacturer: "SKF",
    plant: "Gamsberg",
    segment: "A-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 8400,
    current: { rop: 180, safetyStock: 90, maxStock: 420 },
    recommended: { rop: 240, safetyStock: 120, maxStock: 480 },
    confidence: 92,
    status: "Pending review",
    leadTime: { plannedDays: 28, actualDays: 41 },
    serviceLevelTargetPct: 97,
    stockOuts24m: 3,
    consumption: [
      74, 81, 69, 58, 77, 84, 108, 115, 102, 79, 86, 73, 88, 94, 82, 66, 91, 99,
      126, 138, 121, 96, 104, 112,
    ],
    forecastGrowth: 1.12,
    forecastBandPct: 0.18,
    rationale: [
      "Consumption up 34% over the last 12 months against the prior 12 (mean 101/mo vs 75/mo).",
      "Actual supplier lead time 41 days against 28 planned — mean of the last six goods receipts.",
      "Seasonal peak Mar–May runs about 1.4x the annual mean; the current ROP was set off a flat average.",
      "Three stock-outs in the last 24 months, all inside the Mar–May window.",
    ],
  },
  {
    id: "IOR-002",
    materialId: "500-22254",
    description: "Troughing Roller Set, 35°",
    manufacturer: "Dunlop",
    plant: "Gamsberg",
    segment: "A-X",
    mrpType: "V2",
    unitOfMeasure: "SET",
    unitCostZar: 4200,
    current: { rop: 320, safetyStock: 160, maxStock: 760 },
    recommended: { rop: 265, safetyStock: 105, maxStock: 620 },
    confidence: 88,
    status: "Pending review",
    leadTime: { plannedDays: 21, actualDays: 18 },
    serviceLevelTargetPct: 95,
    stockOuts24m: 0,
    consumption: [
      168, 155, 149, 132, 161, 158, 186, 179, 172, 144, 139, 151, 133, 128, 121,
      104, 118, 112, 131, 126, 119, 101, 97, 103,
    ],
    forecastGrowth: 0.92,
    forecastBandPct: 0.15,
    rationale: [
      "Consumption down 24% year on year after the CV-04 route was re-lagged with longer-life idlers.",
      "Actual lead time 18 days against 21 planned — supplier is consistently early.",
      "No stock-outs in 24 months, at a service level running above the 95% target.",
      "Safety stock currently covers 32 days of demand against a 21-day planned lead time.",
    ],
  },
  {
    id: "IOR-003",
    materialId: "500-40056",
    description: "Bearing, Deep Groove Ball, Motor DE",
    manufacturer: "NSK",
    plant: "BMM",
    segment: "B-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 3900,
    current: { rop: 140, safetyStock: 70, maxStock: 330 },
    recommended: { rop: 96, safetyStock: 42, maxStock: 240 },
    confidence: 85,
    status: "Pending review",
    leadTime: { plannedDays: 14, actualDays: 12 },
    serviceLevelTargetPct: 95,
    stockOuts24m: 0,
    consumption: [
      62, 58, 66, 51, 64, 59, 71, 68, 63, 55, 60, 57, 54, 61, 49, 43, 56, 52,
      60, 58, 54, 47, 51, 48,
    ],
    forecastGrowth: 0.94,
    forecastBandPct: 0.14,
    rationale: [
      "Demand flat to slightly declining — 12-month mean 53/mo against 61/mo in the prior year.",
      "Low demand variability (CV 0.13) supports a tighter safety stock at the same 95% service level.",
      "Actual lead time 12 days against 14 planned, with no late receipts in 24 months.",
      "Local distributor holds consignment stock, so a shorter cover period carries little exposure.",
    ],
  },
  {
    id: "IOR-004",
    materialId: "500-40098",
    description: "Bearing, Cylindrical Roller, Gearbox",
    manufacturer: "FAG",
    plant: "Gamsberg",
    segment: "B-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 9800,
    current: { rop: 48, safetyStock: 24, maxStock: 120 },
    recommended: { rop: 34, safetyStock: 15, maxStock: 88 },
    confidence: 81,
    status: "Approved",
    leadTime: { plannedDays: 35, actualDays: 31 },
    serviceLevelTargetPct: 95,
    stockOuts24m: 1,
    consumption: [
      19, 16, 21, 14, 18, 17, 24, 22, 20, 15, 17, 16, 14, 18, 13, 11, 16, 15,
      19, 18, 16, 12, 14, 13,
    ],
    forecastGrowth: 0.9,
    forecastBandPct: 0.2,
    rationale: [
      "Consumption down 18% year on year following the gearbox overhaul programme.",
      "Actual lead time 31 days against 35 planned.",
      "Max stock is currently 7.7 months of cover — well beyond the 3-month policy ceiling for B-X.",
    ],
  },
  {
    id: "IOR-005",
    materialId: "500-22301",
    description: "Bearing, Spherical Roller, Head Pulley",
    manufacturer: "SKF",
    plant: "BMM",
    segment: "B-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 14600,
    current: { rop: 26, safetyStock: 12, maxStock: 64 },
    recommended: { rop: 34, safetyStock: 18, maxStock: 78 },
    confidence: 79,
    status: "Pending review",
    leadTime: { plannedDays: 30, actualDays: 47 },
    serviceLevelTargetPct: 97,
    stockOuts24m: 2,
    consumption: [
      8, 7, 9, 6, 8, 10, 12, 11, 9, 7, 8, 9, 10, 11, 9, 8, 12, 13, 16, 18, 15,
      12, 14, 15,
    ],
    forecastGrowth: 1.18,
    forecastBandPct: 0.24,
    rationale: [
      "Consumption up 41% year on year as the BMM overland conveyor moved to continuous operation.",
      "Actual lead time 47 days against 30 planned — the import route now clears through Durban, not Cape Town.",
      "Two stock-outs in 24 months, each holding up a head-pulley change-out.",
      "Head pulley failure stops the route, so the 97% service level is the binding constraint.",
    ],
  },
  {
    id: "IOR-006",
    materialId: "500-31005",
    description: "Pressure Transmitter, Cerabar PMC21",
    manufacturer: "Endress+Hauser",
    plant: "Gamsberg",
    segment: "C-Y",
    mrpType: "V2",
    unitOfMeasure: "EA",
    unitCostZar: 18900,
    current: { rop: 18, safetyStock: 9, maxStock: 44 },
    recommended: { rop: 12, safetyStock: 5, maxStock: 30 },
    confidence: 74,
    status: "Pending review",
    leadTime: { plannedDays: 42, actualDays: 38 },
    serviceLevelTargetPct: 90,
    stockOuts24m: 0,
    consumption: [
      6, 4, 7, 3, 5, 6, 8, 5, 7, 4, 3, 6, 5, 4, 6, 2, 5, 3, 6, 4, 5, 3, 4, 3,
    ],
    forecastGrowth: 0.85,
    forecastBandPct: 0.35,
    rationale: [
      "Low-value, moderately variable demand (CV 0.34) — a C-Y item carrying A-item cover.",
      "Consumption down 21% year on year as instrument loops migrate to the Radar FMR10.",
      "No stock-outs in 24 months; the 90% service target is being met at roughly 99%.",
      "Confidence is capped at 74% by the demand variability — worth a planner sanity check.",
    ],
  },
  {
    id: "IOR-007",
    materialId: "500-14905",
    description: "Seal Assy, Mech Type XR-150",
    manufacturer: "Flowserve",
    plant: "Gamsberg",
    segment: "A-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 31400,
    current: { rop: 22, safetyStock: 11, maxStock: 54 },
    recommended: { rop: 16, safetyStock: 7, maxStock: 40 },
    confidence: 90,
    status: "Approved",
    leadTime: { plannedDays: 25, actualDays: 22 },
    serviceLevelTargetPct: 97,
    stockOuts24m: 0,
    consumption: [
      9, 11, 8, 7, 10, 9, 13, 12, 11, 8, 9, 10, 8, 9, 7, 6, 9, 8, 11, 10, 9, 7,
      8, 7,
    ],
    forecastGrowth: 0.9,
    forecastBandPct: 0.2,
    rationale: [
      "Consumption down 15% year on year since the milling pumps moved to the longer-life XR-200 seal.",
      "Actual lead time 22 days against 25 planned across nine receipts.",
      "Highest unit cost in the sample — a four-unit safety-stock reduction releases R125 600.",
    ],
  },
  {
    id: "IOR-008",
    materialId: "500-19645",
    description: "Slurry Valve, Knife Gate",
    manufacturer: "Weir",
    plant: "BMM",
    segment: "B-X",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 47200,
    current: { rop: 14, safetyStock: 7, maxStock: 34 },
    recommended: { rop: 9, safetyStock: 4, maxStock: 24 },
    confidence: 68,
    status: "Rejected",
    leadTime: { plannedDays: 45, actualDays: 52 },
    serviceLevelTargetPct: 95,
    stockOuts24m: 1,
    consumption: [
      5, 3, 6, 2, 4, 5, 7, 6, 4, 3, 5, 4, 3, 5, 2, 4, 6, 3, 5, 7, 4, 2, 3, 4,
    ],
    forecastGrowth: 0.95,
    forecastBandPct: 0.3,
    rationale: [
      "Demand broadly flat, but the 52-day actual lead time exceeds the 45-day plan.",
      "Confidence 68% — 24 months of history is thin for a valve with this replacement profile.",
      "Rejected by the planner: the tailings line change-out scheduled for Q4 FY26 is not in the history.",
    ],
  },
  {
    id: "IOR-009",
    materialId: "500-61140",
    description: "Mill Liner Segment, Shell, Rubber-Steel",
    manufacturer: "Multotec",
    plant: "Gamsberg",
    segment: "A-X",
    mrpType: "V2",
    unitOfMeasure: "EA",
    unitCostZar: 58900,
    current: { rop: 64, safetyStock: 32, maxStock: 150 },
    recommended: { rop: 48, safetyStock: 20, maxStock: 120 },
    confidence: 87,
    status: "Approved",
    leadTime: { plannedDays: 56, actualDays: 49 },
    serviceLevelTargetPct: 97,
    stockOuts24m: 0,
    consumption: [
      38, 34, 41, 29, 36, 33, 47, 44, 39, 31, 35, 32, 30, 34, 28, 24, 31, 29,
      38, 36, 33, 26, 28, 27,
    ],
    forecastGrowth: 0.88,
    forecastBandPct: 0.16,
    rationale: [
      "Reline interval extended from 14 to 18 weeks, cutting annual draw by roughly 19%.",
      "Relines are scheduled, so demand is planned rather than random — cover can follow the reline calendar.",
      "Actual lead time 49 days against 56 planned across the last four campaigns.",
      "Largest single working-capital release in the sample, at R706 800.",
    ],
  },
  {
    id: "IOR-010",
    materialId: "500-61208",
    description: "Mill Liner Bolt Set, M42",
    manufacturer: "Multotec",
    plant: "Gamsberg",
    segment: "A-X",
    mrpType: "V2",
    unitOfMeasure: "SET",
    unitCostZar: 2650,
    current: { rop: 900, safetyStock: 450, maxStock: 2100 },
    recommended: { rop: 1150, safetyStock: 560, maxStock: 2400 },
    confidence: 83,
    status: "Pending review",
    leadTime: { plannedDays: 30, actualDays: 44 },
    serviceLevelTargetPct: 97,
    stockOuts24m: 2,
    consumption: [
      420, 465, 398, 352, 441, 468, 585, 612, 548, 432, 470, 415, 486, 512, 449,
      388, 501, 534, 668, 702, 631, 498, 542, 576,
    ],
    forecastGrowth: 1.15,
    forecastBandPct: 0.14,
    rationale: [
      "Consumption up 16% year on year — bolt sets are now replaced at every reline, not every second one.",
      "Actual lead time 44 days against 30 planned; the local thread-rolling supplier is at capacity.",
      "Two stock-outs in 24 months, each deferring a reline by a shift.",
      "Low unit cost against a high stoppage cost — the risk case favours holding more, not less.",
    ],
  },
  {
    id: "IOR-011",
    materialId: "500-27415",
    description: "Pulley Lagging, Ceramic, 1200mm",
    manufacturer: "Dunlop",
    plant: "BMM",
    segment: "C-Y",
    mrpType: "VB",
    unitOfMeasure: "M",
    unitCostZar: 23800,
    current: { rop: 12, safetyStock: 6, maxStock: 30 },
    recommended: { rop: 8, safetyStock: 3, maxStock: 22 },
    confidence: 66,
    status: "Rejected",
    leadTime: { plannedDays: 40, actualDays: 36 },
    serviceLevelTargetPct: 90,
    stockOuts24m: 0,
    consumption: [
      4, 3, 5, 2, 4, 3, 6, 5, 4, 2, 3, 4, 3, 4, 2, 3, 4, 2, 5, 4, 3, 2, 3, 2,
    ],
    forecastGrowth: 0.9,
    forecastBandPct: 0.28,
    rationale: [
      "Low, lumpy demand — 12-month mean 3.0 m/mo with a CV of 0.31.",
      "Confidence 66%, the lowest proposal in the sample.",
      "Rejected by engineering: lagging is cut to length on site, so a part-roll cannot be treated as cover.",
    ],
  },
  {
    id: "IOR-012",
    materialId: "500-40011",
    description: "Bearing, Spherical Roller, Mill Trunnion",
    manufacturer: "Timken",
    plant: "Gamsberg",
    segment: "Z",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 142000,
    current: { rop: 2, safetyStock: 2, maxStock: 4 },
    recommended: null,
    confidence: null,
    status: "Excluded — engineering review",
    leadTime: { plannedDays: 120, actualDays: 138 },
    serviceLevelTargetPct: 99,
    stockOuts24m: 0,
    consumption: [
      0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
    ],
    forecastGrowth: 1,
    forecastBandPct: 0.6,
    rationale: [
      "Three issues in 24 months — too few observations to fit a demand distribution.",
      "138-day actual lead time, against a mill stoppage cost measured in millions per day.",
      "Holding policy here is a risk decision, not a statistical one.",
    ],
    exclusionReason:
      "Z segment — erratic demand on a critical insurance spare. No automatic proposal; cover is set by engineering against the failure consequence.",
  },
  {
    id: "IOR-013",
    materialId: "500-55210",
    description: "Motor, TEFC, 132kW 4-pole",
    manufacturer: "WEG",
    plant: "BMM",
    segment: "Z",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 98700,
    current: { rop: 3, safetyStock: 2, maxStock: 6 },
    recommended: null,
    confidence: null,
    status: "Excluded — engineering review",
    leadTime: { plannedDays: 90, actualDays: 104 },
    serviceLevelTargetPct: 98,
    stockOuts24m: 1,
    consumption: [
      0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ],
    forecastGrowth: 1,
    forecastBandPct: 0.55,
    rationale: [
      "Six issues in 24 months, clustered rather than spread — a burst pattern the model cannot project.",
      "Rewind is an option on two of the three frame sizes, which the consumption history does not capture.",
      "104-day actual lead time against 90 planned.",
    ],
    exclusionReason:
      "Z segment — erratic demand. Routed to engineering review so the rewind-versus-replace policy can be applied before any parameter change.",
  },
  {
    id: "IOR-014",
    materialId: "500-73024",
    description: "Pump Assembly, Vertical Spindle Sump",
    manufacturer: "Weir Minerals",
    plant: "Gamsberg",
    segment: "Z",
    mrpType: "VB",
    unitOfMeasure: "EA",
    unitCostZar: 213500,
    current: { rop: 1, safetyStock: 1, maxStock: 2 },
    recommended: null,
    confidence: null,
    status: "Excluded — engineering review",
    leadTime: { plannedDays: 150, actualDays: 150 },
    serviceLevelTargetPct: 99,
    stockOuts24m: 0,
    consumption: [
      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
    ],
    forecastGrowth: 1,
    forecastBandPct: 0.65,
    rationale: [
      "Two issues in 24 months against a 150-day lead time.",
      "Held as a single insurance spare — the parameter set encodes a decision, not a forecast.",
    ],
    exclusionReason:
      "Insurance spare — held against consequence of failure regardless of consumption. Excluded from automatic proposals by policy.",
  },
]

// ---------------------------------------------------------------------------
// Change proposals — the governed batches handed to the SAP team.
// CP-2026-014 is the open draft that newly approved rows land in.
// ---------------------------------------------------------------------------

export const CHANGE_PROPOSAL_BATCHES: ChangeProposalBatch[] = [
  {
    id: OPEN_PROPOSAL_ID,
    status: "Draft",
    itemCount: 9,
    valueImpactZar: -2_310_000,
    raisedOn: "24 Aug 2026",
    note: "Open batch — collecting planner approvals for the September mass-maintenance run.",
  },
  {
    id: "CP-2026-013",
    status: "Submitted to SAP team",
    itemCount: 17,
    valueImpactZar: -4_860_000,
    raisedOn: "29 Jul 2026",
    submittedOn: "18 Aug 2026",
    note: "MM17 mass maintenance scheduled in the 5 Sep 2026 change window.",
  },
  {
    id: "CP-2026-012",
    status: "Submitted to SAP team",
    itemCount: 12,
    valueImpactZar: -3_020_000,
    raisedOn: "26 Jun 2026",
    submittedOn: "21 Jul 2026",
    note: "Applied 2 Aug 2026 — change documents retained against each material master.",
  },
]
