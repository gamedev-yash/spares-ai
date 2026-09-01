// Mock data for the End-to-End Spares Utilisation Tracking view (Initiative 13).
// All figures are illustrative — see the programme reference numbers cited
// alongside each curated aggregate below. The ledger is a small illustrative
// sample of lines, not a source the aggregates are summed from (same
// separation used in mock-data.ts between the VZI aggregates and the
// situation-analysis drill-down sample).

export type UtilisationPlant = "Gamsberg" | "BMM"

/** VZI's five-tier spares criticality taxonomy. */
export type Criticality = "CRITICAL" | "IMPACT" | "INSURANCE" | "NORMAL" | "OBSOLETE"

export type ChainStatus = "Fully linked" | "Broken link"

// ---------------------------------------------------------------------------
// KPI summary
// ---------------------------------------------------------------------------

export interface UtilisationKpiSummary {
  unissuedValueZarMn: number
  utilisation30dPct: number
  redeploymentOpportunities: { count: number; valueZar: number }
  brokenChainPct: number
}

export function getUtilisationKpiSummary(): UtilisationKpiSummary {
  return {
    unissuedValueZarMn: idleAgingTotalZarMn(),
    utilisation30dPct: 58,
    redeploymentOpportunities: {
      count: REDEPLOYMENT_RECOMMENDATIONS.length,
      valueZar: REDEPLOYMENT_RECOMMENDATIONS.reduce(
        (sum, r) => sum + r.avoidedBuyValue,
        0
      ),
    },
    brokenChainPct: 12,
  }
}

// ---------------------------------------------------------------------------
// Reservation-to-Consumption Ledger (CAPTURE + STITCH) — illustrative sample
// ---------------------------------------------------------------------------

export interface LedgerRow {
  id: string
  materialId: string // material code, format 500-XXXXX
  description: string
  plant: UtilisationPlant
  requestor: string
  costCentre: string // cost centre or work order
  reservationRef: string // "—" when the chain can't be stitched back to a reservation
  poRef: string // "—" when the chain can't be stitched to a PO
  grDate: string // "DD MMM YYYY"
  issueDate: string | null // "DD MMM YYYY", or null when not yet issued
  /** Days GR -> issue (issued rows) or GR -> snapshot date, 1 Sep 2026 (unissued rows). */
  daysSinceGr: number
  chainStatus: ChainStatus
  criticality: Criticality
  value: number // ZAR
  /** Shown as a tooltip on the chain-status badge when broken. */
  brokenReason?: string
}

export const UTILISATION_LEDGER: LedgerRow[] = [
  {
    id: "L-01",
    materialId: "500-71042",
    description: "Conveyor idler roller 150mm",
    plant: "Gamsberg",
    requestor: "T. Mokoena",
    costCentre: "CC-4021-MILL",
    reservationRef: "RR-9021",
    poRef: "PO-55210",
    grDate: "14 May 2026",
    issueDate: "22 May 2026",
    daysSinceGr: 8,
    chainStatus: "Fully linked",
    criticality: "NORMAL",
    value: 18400,
  },
  {
    id: "L-02",
    materialId: "500-71089",
    description: "Ball mill liner plate",
    plant: "Gamsberg",
    requestor: "T. Mokoena",
    costCentre: "CC-4021-MILL",
    reservationRef: "RR-9034",
    poRef: "PO-55240",
    grDate: "02 Jun 2026",
    issueDate: null,
    daysSinceGr: 91,
    chainStatus: "Fully linked",
    criticality: "CRITICAL",
    value: 246000,
  },
  {
    id: "L-03",
    materialId: "500-64410",
    description: "Slurry pump impeller",
    plant: "BMM",
    requestor: "L. Dlamini",
    costCentre: "CC-5108-CONV",
    reservationRef: "RR-9102",
    poRef: "PO-55301",
    grDate: "20 Jun 2026",
    issueDate: "25 Jun 2026",
    daysSinceGr: 5,
    chainStatus: "Fully linked",
    criticality: "IMPACT",
    value: 132500,
  },
  {
    id: "L-04",
    materialId: "500-64455",
    description: "Cyclone feed pump casing",
    plant: "BMM",
    requestor: "L. Dlamini",
    costCentre: "CC-5108-CONV",
    reservationRef: "RR-9110",
    poRef: "—",
    grDate: "05 Jul 2026",
    issueDate: null,
    daysSinceGr: 58,
    chainStatus: "Broken link",
    criticality: "IMPACT",
    value: 98700,
    brokenReason: "GR has no matching PO — can't stitch reservation → PO → GR.",
  },
  {
    id: "L-05",
    materialId: "500-58820",
    description: "Flotation cell agitator shaft",
    plant: "Gamsberg",
    requestor: "S. van der Merwe",
    costCentre: "CC-3312-FLOT",
    reservationRef: "RR-9145",
    poRef: "PO-55388",
    grDate: "10 Jul 2026",
    issueDate: null,
    daysSinceGr: 53,
    chainStatus: "Fully linked",
    criticality: "CRITICAL",
    value: 187300,
  },
  {
    id: "L-06",
    materialId: "500-58890",
    description: "Flotation cell rotor",
    plant: "Gamsberg",
    requestor: "S. van der Merwe",
    costCentre: "CC-3312-FLOT",
    reservationRef: "RR-9150",
    poRef: "PO-55390",
    grDate: "12 Jul 2026",
    issueDate: "18 Jul 2026",
    daysSinceGr: 6,
    chainStatus: "Fully linked",
    criticality: "IMPACT",
    value: 154900,
  },
  {
    id: "L-07",
    materialId: "500-40012",
    description: "Pressure transmitter 4-20mA",
    plant: "BMM",
    requestor: "R. Naidoo",
    costCentre: "CC-2207-INST",
    reservationRef: "RR-9188",
    poRef: "PO-55420",
    grDate: "22 Jul 2026",
    issueDate: "02 Aug 2026",
    daysSinceGr: 11,
    chainStatus: "Fully linked",
    criticality: "NORMAL",
    value: 22100,
  },
  {
    id: "L-08",
    materialId: "500-40033",
    description: "Load cell sensor 10T",
    plant: "BMM",
    requestor: "R. Naidoo",
    costCentre: "CC-2207-INST",
    reservationRef: "—",
    poRef: "PO-55430",
    grDate: "25 Jul 2026",
    issueDate: "30 Jul 2026",
    daysSinceGr: 5,
    chainStatus: "Broken link",
    criticality: "NORMAL",
    value: 15600,
    brokenReason: "Issued against a PO with no reservation on record — emergency stock draw.",
  },
  {
    id: "L-09",
    materialId: "500-82011",
    description: "Mill gearbox coupling",
    plant: "Gamsberg",
    requestor: "P. Botha",
    costCentre: "WO-88214",
    reservationRef: "RR-9210",
    poRef: "PO-55475",
    grDate: "01 Aug 2026",
    issueDate: null,
    daysSinceGr: 31,
    chainStatus: "Fully linked",
    criticality: "IMPACT",
    value: 211000,
  },
  {
    id: "L-10",
    materialId: "500-82077",
    description: "SAG mill trunnion seal",
    plant: "Gamsberg",
    requestor: "P. Botha",
    costCentre: "WO-88214",
    reservationRef: "RR-9215",
    poRef: "PO-55480",
    grDate: "03 Aug 2026",
    issueDate: null,
    daysSinceGr: 29,
    chainStatus: "Fully linked",
    criticality: "CRITICAL",
    value: 268500,
  },
  {
    id: "L-11",
    materialId: "500-33410",
    description: "Vibrating screen deck panel",
    plant: "BMM",
    requestor: "K. Sithole",
    costCentre: "CC-5108-CONV",
    reservationRef: "RR-9250",
    poRef: "—",
    grDate: "08 Aug 2026",
    issueDate: null,
    daysSinceGr: 24,
    chainStatus: "Broken link",
    criticality: "NORMAL",
    value: 41800,
    brokenReason: "GR has no matching PO — can't stitch reservation → PO → GR.",
  },
  {
    id: "L-12",
    materialId: "500-33455",
    description: "Conveyor pulley bearing",
    plant: "BMM",
    requestor: "K. Sithole",
    costCentre: "CC-5108-CONV",
    reservationRef: "RR-9260",
    poRef: "PO-55520",
    grDate: "12 Aug 2026",
    issueDate: "20 Aug 2026",
    daysSinceGr: 8,
    chainStatus: "Fully linked",
    criticality: "NORMAL",
    value: 27300,
  },
  {
    id: "L-13",
    materialId: "500-91002",
    description: "Thickener rake arm segment",
    plant: "Gamsberg",
    requestor: "S. van der Merwe",
    costCentre: "CC-3312-FLOT",
    reservationRef: "RR-9280",
    poRef: "PO-55540",
    grDate: "15 Aug 2026",
    issueDate: null,
    daysSinceGr: 17,
    chainStatus: "Fully linked",
    criticality: "OBSOLETE",
    value: 63200,
  },
  {
    id: "L-14",
    materialId: "500-91050",
    description: "Cyclone underflow valve",
    plant: "Gamsberg",
    requestor: "T. Mokoena",
    costCentre: "CC-4021-MILL",
    reservationRef: "—",
    poRef: "PO-55555",
    grDate: "18 Aug 2026",
    issueDate: null,
    daysSinceGr: 14,
    chainStatus: "Broken link",
    criticality: "INSURANCE",
    value: 34900,
    brokenReason: "No reservation on record for this GR — requestor context lost.",
  },
]

// ---------------------------------------------------------------------------
// Idle-stock aging (WATCH) — GR'd-not-issued value by age bucket and plant.
// Curated to the programme reference: NMI & SMI inventory ≈ ZAR 148.7M, so an
// idle pool in the single-digit millions before redeployment is plausible.
// ---------------------------------------------------------------------------

export interface IdleAgingBucket {
  bucket: string
  Gamsberg: number // ZAR millions
  BMM: number // ZAR millions
}

export const IDLE_AGING_BUCKETS: IdleAgingBucket[] = [
  { bucket: "0–30d", Gamsberg: 1.05, BMM: 0.82 },
  { bucket: "31–60d", Gamsberg: 1.28, BMM: 1.04 },
  { bucket: "61–90d", Gamsberg: 0.96, BMM: 0.87 },
  { bucket: "90+d", Gamsberg: 1.78, BMM: 1.8 },
]

export function idleAgingTotalZarMn(): number {
  return IDLE_AGING_BUCKETS.reduce((sum, b) => sum + b.Gamsberg + b.BMM, 0)
}

export function idleAgingByPlantZarMn(): Record<UtilisationPlant, number> {
  return IDLE_AGING_BUCKETS.reduce(
    (acc, b) => {
      acc.Gamsberg += b.Gamsberg
      acc.BMM += b.BMM
      return acc
    },
    { Gamsberg: 0, BMM: 0 }
  )
}

// ---------------------------------------------------------------------------
// Redeployment recommendations (ACT) — advisory, human-approved.
// ---------------------------------------------------------------------------

export interface RedeploymentRecommendation {
  id: string
  materialId: string
  description: string
  idleUnits: number
  idlePlant: UtilisationPlant
  idleAgingDays: number
  demandPlant: UtilisationPlant
  demandRef: string // PR ref
  avoidedBuyValue: number // ZAR
  confidencePct: number
}

export const REDEPLOYMENT_RECOMMENDATIONS: RedeploymentRecommendation[] = [
  {
    id: "RD-01",
    materialId: "500-82077",
    description: "SAG mill trunnion seal",
    idleUnits: 3,
    idlePlant: "BMM",
    idleAgingDays: 142,
    demandPlant: "Gamsberg",
    demandRef: "PR-71820",
    avoidedBuyValue: 402000,
    confidencePct: 88,
  },
  {
    id: "RD-02",
    materialId: "500-58890",
    description: "Flotation cell rotor",
    idleUnits: 2,
    idlePlant: "Gamsberg",
    idleAgingDays: 118,
    demandPlant: "BMM",
    demandRef: "PR-71865",
    avoidedBuyValue: 268500,
    confidencePct: 82,
  },
  {
    id: "RD-03",
    materialId: "500-64410",
    description: "Slurry pump impeller",
    idleUnits: 4,
    idlePlant: "BMM",
    idleAgingDays: 96,
    demandPlant: "Gamsberg",
    demandRef: "PR-71902",
    avoidedBuyValue: 187300,
    confidencePct: 79,
  },
  {
    id: "RD-04",
    materialId: "500-40012",
    description: "Pressure transmitter 4-20mA",
    idleUnits: 6,
    idlePlant: "Gamsberg",
    idleAgingDays: 104,
    demandPlant: "BMM",
    demandRef: "PR-71944",
    avoidedBuyValue: 92600,
    confidencePct: 74,
  },
  {
    id: "RD-05",
    materialId: "500-33455",
    description: "Conveyor pulley bearing",
    idleUnits: 5,
    idlePlant: "BMM",
    idleAgingDays: 87,
    demandPlant: "Gamsberg",
    demandRef: "PR-71988",
    avoidedBuyValue: 68900,
    confidencePct: 69,
  },
]

// ---------------------------------------------------------------------------
// Requestor accountability — top 5 by unissued value (company-wide curated).
// ---------------------------------------------------------------------------

export interface RequestorUnissuedRow {
  requestor: string
  costCentre: string
  unissuedValueZar: number
}

export const TOP_REQUESTORS_BY_UNISSUED: RequestorUnissuedRow[] = [
  { requestor: "P. Botha", costCentre: "WO-88214", unissuedValueZar: 1240000 },
  { requestor: "T. Mokoena", costCentre: "CC-4021-MILL", unissuedValueZar: 968000 },
  { requestor: "S. van der Merwe", costCentre: "CC-3312-FLOT", unissuedValueZar: 812500 },
  { requestor: "L. Dlamini", costCentre: "CC-5108-CONV", unissuedValueZar: 705300 },
  { requestor: "K. Sithole", costCentre: "CC-5108-CONV", unissuedValueZar: 588900 },
]
