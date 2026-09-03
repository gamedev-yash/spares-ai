// Mock data for Initiative 13 — End-to-End Spares Utilisation Tracking.
// Scope is OAR (Order-as-Required) materials at Gamsberg and Black Mountain.
// All figures are illustrative. Aggregate KPIs, the aging buckets, redeployment
// recommendations and accountability rows are curated company-wide figures —
// the ledger below is a small illustrative sample of lines (per source doc
// section 3.3), not a set the aggregates are summed from (mirrors the existing
// separation in mock-data.ts between the VZI aggregates and the
// situation-analysis drill-down sample).

import { formatDateDMY } from "@/lib/utils"

export type UtilisationPlant = "Gamsberg" | "Black Mountain"

/** Secondary abbreviation shown alongside the full plant name where compact. */
export const PLANT_ABBR: Record<UtilisationPlant, string> = {
  Gamsberg: "Gamsberg",
  "Black Mountain": "BMM",
}

/**
 * How a reservation line's demand was pegged to a purchase requisition.
 * "Shared allocation" = the daily MRP run consolidated same-day/same-material/
 * same-plant demand into one PR; this line's share is FIFO-allocated by
 * requirement date, not a hard one-to-one link.
 */
export type PrAllocationType = "Direct" | "Shared allocation" | "None"

export type ChainStatus =
  | "Fully linked"
  | "Shared allocation"
  | "Reconstructed"
  | "Broken link"
  | "Awaiting reconciliation"

export type UtilisationStatus =
  | "Confirmed consumed"
  | "Awaiting confirmation"
  | "Delayed"
  | "No longer required"
  | "Not yet due"

/** What the line's aging is computed against. */
export type AgingBasis = "Planned consumption date" | "Historical GR fallback" | "Not aging"

export type EscalationStage =
  | "Not applicable"
  | "Requester notified"
  | "Requester overdue"
  | "HOD escalated"
  | "Inventory control review"
  | "Resolved"

export interface UtilisationEvent {
  stage: string
  date: string // "DD MMM YYYY"
  detail: string
}

export interface UtilisationLedgerRow {
  id: string
  /** Platform tracking ID assigned at RR submission — null for pre-programme legacy lines. */
  trackingId: string | null

  reservationNumber: string // RSNUM, or "—" for an unreferenced offline issue
  reservationLine: string // RSPOS

  materialCode: string
  materialDescription: string

  plant: UtilisationPlant

  requester: string
  department: string
  costCentre?: string
  workOrder?: string
  project?: string
  purpose: string

  requirementDate: string | null
  plannedConsumptionDate: string | null
  previousPlannedConsumptionDate?: string
  replanReason?: string

  requestedQty: number
  storeIssuedQty: number
  procurementQty: number
  uom: string

  prNumber: string | null
  prAllocationType: PrAllocationType
  allocationNote?: string

  poNumber: string | null

  goodsReceiptDate: string | null
  goodsReceiptQty: number

  goodsIssueDate: string | null
  goodsIssueQty: number

  utilisationStatus: UtilisationStatus
  utilisationConfirmedDate: string | null

  chainStatus: ChainStatus
  reconciliationNote?: string
  reconciliationConfidencePct?: number

  agingDays: number
  agingBasis: AgingBasis
  escalationStage: EscalationStage

  /** Curated display label + tone for the ledger's "Exception / Aging" column. */
  exceptionLabel: string
  exceptionTone: "default" | "success" | "warning" | "danger"

  valueZar: number

  events: UtilisationEvent[]
}

export const UTILISATION_LEDGER: UtilisationLedgerRow[] = [
  // A — fully linked, consumed on time
  {
    id: "L-01",
    trackingId: "SPR-TRK-40011",
    reservationNumber: "RS-810211",
    reservationLine: "0010",
    materialCode: "500-71042",
    materialDescription: "Conveyor idler roller 150mm",
    plant: "Gamsberg",
    requester: "T. Mokoena",
    department: "Mining Maintenance",
    costCentre: "CC-4021-MILL",
    workOrder: "WO-77031",
    purpose: "Replace worn idler on CV-14 conveyor return station",
    requirementDate: "09 May 2026",
    plannedConsumptionDate: "20 May 2026",
    requestedQty: 4,
    storeIssuedQty: 0,
    procurementQty: 4,
    uom: "EA",
    prNumber: "PR-71010",
    prAllocationType: "Direct",
    poNumber: "PO-55210",
    goodsReceiptDate: "14 May 2026",
    goodsReceiptQty: 4,
    goodsIssueDate: "16 May 2026",
    goodsIssueQty: 4,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "20 May 2026",
    chainStatus: "Fully linked",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "On plan",
    exceptionTone: "success",
    valueZar: 18400,
    events: [
      { stage: "Requested", date: "09 May 2026", detail: "RR raised with consumption plan" },
      { stage: "Approved", date: "10 May 2026", detail: "HOD 1 approval" },
      { stage: "On PR", date: "11 May 2026", detail: "PR-71010 raised" },
      { stage: "On PO", date: "12 May 2026", detail: "PO-55210 issued" },
      { stage: "Received", date: "14 May 2026", detail: "GR posted, 4 EA" },
      { stage: "Issued", date: "16 May 2026", detail: "Goods issue against RS-810211/0010" },
      { stage: "Confirmed", date: "20 May 2026", detail: "Requester confirmed consumed, on plan" },
    ],
  },
  // B — received but planned consumption date passed, deep in backlog
  {
    id: "L-02",
    trackingId: "SPR-TRK-40034",
    reservationNumber: "RS-810234",
    reservationLine: "0010",
    materialCode: "500-71089",
    materialDescription: "Ball mill liner plate",
    plant: "Gamsberg",
    requester: "T. Mokoena",
    department: "Mining Maintenance",
    costCentre: "CC-4021-MILL",
    workOrder: "WO-77088",
    purpose: "Scheduled liner change-out, Mill 3",
    requirementDate: "20 May 2026",
    plannedConsumptionDate: "05 Jun 2026",
    requestedQty: 12,
    storeIssuedQty: 0,
    procurementQty: 12,
    uom: "EA",
    prNumber: "PR-71034",
    prAllocationType: "Direct",
    poNumber: "PO-55240",
    goodsReceiptDate: "02 Jun 2026",
    goodsReceiptQty: 12,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 88,
    agingBasis: "Planned consumption date",
    escalationStage: "Inventory control review",
    exceptionLabel: "Inventory control review · 88d",
    exceptionTone: "danger",
    valueZar: 246000,
    events: [
      { stage: "Requested", date: "20 May 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "23 May 2026", detail: "PR-71034 raised" },
      { stage: "On PO", date: "25 May 2026", detail: "PO-55240 issued" },
      { stage: "Received", date: "02 Jun 2026", detail: "GR posted, 12 EA, still in stores" },
      { stage: "Aged", date: "05 Jun 2026", detail: "Planned consumption date breached, unissued" },
      { stage: "Requester notified", date: "06 Jul 2026", detail: "First aging alert sent" },
      { stage: "Requester overdue", date: "20 Jul 2026", detail: "No response after follow-up" },
      { stage: "HOD escalated", date: "04 Aug 2026", detail: "Escalated to HOD 1" },
      { stage: "Inventory control review", date: "18 Aug 2026", detail: "No HOD response, referred to inventory control" },
    ],
  },
  // C — goods issued, awaiting post-issue utilisation confirmation
  {
    id: "L-03",
    trackingId: "SPR-TRK-40067",
    reservationNumber: "RS-810267",
    reservationLine: "0010",
    materialCode: "500-58820",
    materialDescription: "Flotation cell agitator shaft",
    plant: "Gamsberg",
    requester: "S. van der Merwe",
    department: "Concentrator Operations",
    costCentre: "CC-3312-FLOT",
    project: "FLOT-CELL-04 rebuild",
    purpose: "Agitator shaft replacement during planned cell rebuild",
    requirementDate: "28 Jun 2026",
    plannedConsumptionDate: "10 Jul 2026",
    requestedQty: 1,
    storeIssuedQty: 0,
    procurementQty: 1,
    uom: "EA",
    prNumber: "PR-71145",
    prAllocationType: "Direct",
    poNumber: "PO-55388",
    goodsReceiptDate: "08 Jul 2026",
    goodsReceiptQty: 1,
    goodsIssueDate: "11 Jul 2026",
    goodsIssueQty: 1,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 53,
    agingBasis: "Planned consumption date",
    escalationStage: "Requester overdue",
    exceptionLabel: "Requester overdue · 53d",
    exceptionTone: "warning",
    valueZar: 187300,
    events: [
      { stage: "Requested", date: "28 Jun 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "30 Jun 2026", detail: "PR-71145 raised" },
      { stage: "On PO", date: "01 Jul 2026", detail: "PO-55388 issued" },
      { stage: "Received", date: "08 Jul 2026", detail: "GR posted, 1 EA" },
      { stage: "Issued", date: "11 Jul 2026", detail: "Goods issue against RS-810267/0010" },
      { stage: "Aged", date: "25 Jul 2026", detail: "Issued but utilisation not confirmed, grace elapsed" },
      { stage: "Requester notified", date: "26 Jul 2026", detail: "Confirmation request sent" },
      { stage: "Requester overdue", date: "09 Aug 2026", detail: "No confirmation after follow-up" },
    ],
  },
  // D — requester selected Delayed, re-planned once
  {
    id: "L-04",
    trackingId: "SPR-TRK-40091",
    reservationNumber: "RS-810291",
    reservationLine: "0010",
    materialCode: "500-82011",
    materialDescription: "Mill gearbox coupling",
    plant: "Gamsberg",
    requester: "P. Botha",
    department: "Engineering Services",
    workOrder: "WO-77102",
    purpose: "Gearbox coupling replacement, Mill 2 drive end",
    requirementDate: "15 Jul 2026",
    plannedConsumptionDate: "15 Sep 2026",
    previousPlannedConsumptionDate: "25 Jul 2026",
    replanReason: "Mill 2 shutdown moved to the September outage window",
    requestedQty: 2,
    storeIssuedQty: 0,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71210",
    prAllocationType: "Direct",
    poNumber: "PO-55475",
    goodsReceiptDate: "01 Aug 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Delayed",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 0,
    agingBasis: "Planned consumption date",
    escalationStage: "Not applicable",
    exceptionLabel: "Re-planned — new date 15 Sep 2026",
    exceptionTone: "default",
    valueZar: 211000,
    events: [
      { stage: "Requested", date: "15 Jul 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "17 Jul 2026", detail: "PR-71210 raised" },
      { stage: "On PO", date: "18 Jul 2026", detail: "PO-55475 issued" },
      { stage: "Received", date: "01 Aug 2026", detail: "GR posted, 2 EA" },
      { stage: "Aged", date: "25 Jul 2026", detail: "Original planned consumption date breached" },
      { stage: "Requester notified", date: "26 Jul 2026", detail: "Aging alert sent" },
      { stage: "Re-planned", date: "05 Aug 2026", detail: "Requester selected Delayed — new date 15 Sep 2026" },
    ],
  },
  // E — requester selected No Longer Required, released for redeployment
  {
    id: "L-05",
    trackingId: "SPR-TRK-40108",
    reservationNumber: "RS-810308",
    reservationLine: "0010",
    materialCode: "500-58890",
    materialDescription: "Flotation cell rotor",
    plant: "Gamsberg",
    requester: "S. van der Merwe",
    department: "Concentrator Operations",
    costCentre: "CC-3312-FLOT",
    project: "FLOT-CELL-04 rebuild",
    purpose: "Spare rotor held for rebuild contingency",
    requirementDate: "05 Jun 2026",
    plannedConsumptionDate: "20 Jun 2026",
    requestedQty: 2,
    storeIssuedQty: 0,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71150",
    prAllocationType: "Direct",
    poNumber: "PO-55390",
    goodsReceiptDate: "12 Jun 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "No longer required",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 30,
    agingBasis: "Planned consumption date",
    escalationStage: "Resolved",
    exceptionLabel: "Released for redeployment",
    exceptionTone: "success",
    valueZar: 268500,
    events: [
      { stage: "Requested", date: "05 Jun 2026", detail: "RR raised with consumption plan" },
      { stage: "Received", date: "12 Jun 2026", detail: "GR posted, 2 EA" },
      { stage: "Aged", date: "20 Jul 2026", detail: "Planned consumption date breached, unissued" },
      { stage: "Requester notified", date: "21 Jul 2026", detail: "Aging alert sent" },
      { stage: "Released", date: "05 Aug 2026", detail: "Requester selected No Longer Required — rebuild descoped" },
    ],
  },
  // F — MRP-consolidated PR, first of two shared-allocation lines
  {
    id: "L-06",
    trackingId: "SPR-TRK-40122",
    reservationNumber: "RS-810322",
    reservationLine: "0010",
    materialCode: "500-40012",
    materialDescription: "Pressure transmitter 4-20mA",
    plant: "Black Mountain",
    requester: "R. Naidoo",
    department: "Instrumentation",
    costCentre: "CC-2207-INST",
    purpose: "Replace faulty transmitter, Thickener 2 underflow line",
    requirementDate: "20 Jul 2026",
    plannedConsumptionDate: "28 Jul 2026",
    requestedQty: 2,
    storeIssuedQty: 0,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71420",
    prAllocationType: "Shared allocation",
    allocationNote: "PR-71420 consolidates two same-day reservations for this material at Black Mountain; quantity allocated FIFO by requirement date.",
    poNumber: "PO-55420",
    goodsReceiptDate: "30 Jul 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: "02 Aug 2026",
    goodsIssueQty: 2,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "03 Aug 2026",
    chainStatus: "Shared allocation",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "On plan",
    exceptionTone: "success",
    valueZar: 22100,
    events: [
      { stage: "Requested", date: "20 Jul 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "21 Jul 2026", detail: "Consolidated into PR-71420 (2 lines, this plant/material/day)" },
      { stage: "On PO", date: "22 Jul 2026", detail: "PO-55420 issued" },
      { stage: "Received", date: "30 Jul 2026", detail: "GR posted, allocated 2 EA to this line" },
      { stage: "Issued", date: "02 Aug 2026", detail: "Goods issue against RS-810322/0010" },
      { stage: "Confirmed", date: "03 Aug 2026", detail: "Requester confirmed consumed, on plan" },
    ],
  },
  // G — partial availability: stores draw + procurement leg
  {
    id: "L-07",
    trackingId: "SPR-TRK-40145",
    reservationNumber: "RS-810345",
    reservationLine: "0010",
    materialCode: "500-64410",
    materialDescription: "Slurry pump impeller",
    plant: "Black Mountain",
    requester: "L. Dlamini",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    purpose: "Impeller swap, slurry pump P-204",
    requirementDate: "15 Jun 2026",
    plannedConsumptionDate: "25 Jun 2026",
    requestedQty: 3,
    storeIssuedQty: 1,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71102",
    prAllocationType: "Direct",
    poNumber: "PO-55301",
    goodsReceiptDate: "20 Jun 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: "25 Jun 2026",
    goodsIssueQty: 3,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "25 Jun 2026",
    chainStatus: "Fully linked",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "On plan",
    exceptionTone: "success",
    valueZar: 132500,
    events: [
      { stage: "Requested", date: "15 Jun 2026", detail: "RR raised with consumption plan" },
      { stage: "Drawn", date: "16 Jun 2026", detail: "1 EA drawn immediately from stores (immediate leg)" },
      { stage: "On PR", date: "16 Jun 2026", detail: "PR-71102 raised for the 2 EA shortfall" },
      { stage: "On PO", date: "17 Jun 2026", detail: "PO-55301 issued" },
      { stage: "Received", date: "20 Jun 2026", detail: "GR posted, 2 EA (procurement leg)" },
      { stage: "Issued", date: "25 Jun 2026", detail: "Remaining 2 EA issued; both legs now consumed" },
      { stage: "Confirmed", date: "25 Jun 2026", detail: "Requester confirmed consumed, on plan" },
    ],
  },
  // H — manual/offline issue, reconstructed and resolved
  {
    id: "L-08",
    trackingId: "SPR-TRK-40160",
    reservationNumber: "RS-810360",
    reservationLine: "0010",
    materialCode: "500-40033",
    materialDescription: "Load cell sensor 10T",
    plant: "Black Mountain",
    requester: "R. Naidoo",
    department: "Instrumentation",
    costCentre: "CC-2207-INST",
    purpose: "Emergency replacement, weighbridge load cell failure",
    requirementDate: "24 Jul 2026",
    plannedConsumptionDate: "25 Jul 2026",
    requestedQty: 1,
    storeIssuedQty: 1,
    procurementQty: 0,
    uom: "EA",
    prNumber: null,
    prAllocationType: "None",
    poNumber: "PO-55430",
    goodsReceiptDate: null,
    goodsReceiptQty: 0,
    goodsIssueDate: "25 Jul 2026",
    goodsIssueQty: 1,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "25 Jul 2026",
    chainStatus: "Reconstructed",
    reconciliationNote: "Manual issue-book entry, reservation posted retrospectively and matched by material, plant and date proximity.",
    reconciliationConfidencePct: 92,
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Resolved",
    exceptionLabel: "Reconciled",
    exceptionTone: "default",
    valueZar: 15600,
    events: [
      { stage: "Issued", date: "25 Jul 2026", detail: "Emergency issue-book entry posted, no reservation reference yet" },
      { stage: "Re-planned", date: "29 Jul 2026", detail: "Retrospective reservation RS-810360/0010 posted, matched at 92% confidence" },
      { stage: "Confirmed", date: "25 Jul 2026", detail: "Weighbridge load cell replaced same day" },
    ],
  },
  // I — broken link, unresolved, queued for reconciliation
  {
    id: "L-09",
    trackingId: "SPR-TRK-40178",
    reservationNumber: "RS-810378",
    reservationLine: "0010",
    materialCode: "500-33410",
    materialDescription: "Vibrating screen deck panel",
    plant: "Black Mountain",
    requester: "K. Sithole",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    purpose: "Deck panel replacement, screen S-3",
    requirementDate: "30 Jul 2026",
    plannedConsumptionDate: "10 Aug 2026",
    requestedQty: 4,
    storeIssuedQty: 0,
    procurementQty: 4,
    uom: "EA",
    prNumber: null,
    prAllocationType: "None",
    poNumber: "PO-55520",
    goodsReceiptDate: "08 Aug 2026",
    goodsReceiptQty: 4,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Broken link",
    reconciliationNote: "No PR reference found for this GR — flagged for manual reconciliation by inventory control.",
    agingDays: 22,
    agingBasis: "Planned consumption date",
    escalationStage: "Not applicable",
    exceptionLabel: "Awaiting reconciliation · 22d",
    exceptionTone: "danger",
    valueZar: 41800,
    events: [
      { stage: "Requested", date: "30 Jul 2026", detail: "RR raised with consumption plan" },
      { stage: "Received", date: "08 Aug 2026", detail: "GR posted against PO-55520, no PR reference resolved" },
      { stage: "Aged", date: "10 Aug 2026", detail: "Planned consumption date breached, unissued" },
    ],
  },
  // J — sister-plant unused stock, feeds a redeployment recommendation
  {
    id: "L-10",
    trackingId: "SPR-TRK-40203",
    reservationNumber: "RS-810403",
    reservationLine: "0010",
    materialCode: "500-82077",
    materialDescription: "SAG mill trunnion seal",
    plant: "Black Mountain",
    requester: "M. Khumalo",
    department: "Mill Maintenance",
    workOrder: "WO-88214",
    purpose: "Contingency seal for scheduled trunnion inspection",
    requirementDate: "10 Apr 2026",
    plannedConsumptionDate: "25 Apr 2026",
    requestedQty: 3,
    storeIssuedQty: 0,
    procurementQty: 3,
    uom: "EA",
    prNumber: "PR-70210",
    prAllocationType: "Direct",
    poNumber: "PO-54820",
    goodsReceiptDate: "20 Apr 2026",
    goodsReceiptQty: 3,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "No longer required",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 129,
    agingBasis: "Planned consumption date",
    escalationStage: "Resolved",
    exceptionLabel: "Released for redeployment",
    exceptionTone: "success",
    valueZar: 402000,
    events: [
      { stage: "Requested", date: "10 Apr 2026", detail: "RR raised with consumption plan" },
      { stage: "Received", date: "20 Apr 2026", detail: "GR posted, 3 EA" },
      { stage: "Aged", date: "25 May 2026", detail: "Planned consumption date breached, unissued" },
      { stage: "HOD escalated", date: "10 Jul 2026", detail: "Escalated after repeated non-response" },
      { stage: "Released", date: "22 Jul 2026", detail: "Inspection descoped — released as redeployment candidate" },
    ],
  },
  // K — not yet due, fresh pipeline
  {
    id: "L-11",
    trackingId: "SPR-TRK-40221",
    reservationNumber: "RS-810421",
    reservationLine: "0010",
    materialCode: "500-91002",
    materialDescription: "Thickener rake arm segment",
    plant: "Gamsberg",
    requester: "S. van der Merwe",
    department: "Concentrator Operations",
    costCentre: "CC-3312-FLOT",
    purpose: "Planned rake arm segment refurbishment, Thickener 1",
    requirementDate: "20 Aug 2026",
    plannedConsumptionDate: "20 Sep 2026",
    requestedQty: 2,
    storeIssuedQty: 0,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71540",
    prAllocationType: "Direct",
    poNumber: "PO-55540",
    goodsReceiptDate: "28 Aug 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Not yet due",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "Not yet due",
    exceptionTone: "default",
    valueZar: 63200,
    events: [
      { stage: "Requested", date: "20 Aug 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "22 Aug 2026", detail: "PR-71540 raised" },
      { stage: "On PO", date: "23 Aug 2026", detail: "PO-55540 issued" },
      { stage: "Received", date: "28 Aug 2026", detail: "GR posted, 2 EA — plan date still ahead" },
    ],
  },
  // L — historical fallback, predates consumption-plan capture
  {
    id: "L-12",
    trackingId: null,
    reservationNumber: "RS-780987",
    reservationLine: "0010",
    materialCode: "500-91050",
    materialDescription: "Cyclone underflow valve",
    plant: "Gamsberg",
    requester: "T. Mokoena",
    department: "Mining Maintenance",
    costCentre: "CC-4021-MILL",
    purpose: "Not captured — pre-programme straight reservation",
    requirementDate: "12 Feb 2026",
    plannedConsumptionDate: null,
    requestedQty: 6,
    storeIssuedQty: 0,
    procurementQty: 6,
    uom: "EA",
    prNumber: "PR-68810",
    prAllocationType: "Direct",
    poNumber: "PO-53910",
    goodsReceiptDate: "18 Feb 2026",
    goodsReceiptQty: 6,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 150,
    agingBasis: "Historical GR fallback",
    escalationStage: "Inventory control review",
    exceptionLabel: "Historical fallback · 150d",
    exceptionTone: "warning",
    valueZar: 34900,
    events: [
      { stage: "Received", date: "18 Feb 2026", detail: "GR posted, 6 EA — predates consumption-plan capture" },
      { stage: "Aged", date: "04 Apr 2026", detail: "Aging computed from GR date plus a 45-day category grace period" },
      { stage: "Inventory control review", date: "20 Aug 2026", detail: "Flagged for historical-backlog prioritisation" },
    ],
  },
  // M — fully linked and consumed on time, Black Mountain
  {
    id: "L-13",
    trackingId: "SPR-TRK-40255",
    reservationNumber: "RS-810455",
    reservationLine: "0010",
    materialCode: "500-64455",
    materialDescription: "Cyclone feed pump casing",
    plant: "Black Mountain",
    requester: "L. Dlamini",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    purpose: "Pump casing replacement, cyclone feed pump P-118",
    requirementDate: "01 Aug 2026",
    plannedConsumptionDate: "12 Aug 2026",
    requestedQty: 1,
    storeIssuedQty: 0,
    procurementQty: 1,
    uom: "EA",
    prNumber: "PR-71480",
    prAllocationType: "Direct",
    poNumber: "PO-55500",
    goodsReceiptDate: "09 Aug 2026",
    goodsReceiptQty: 1,
    goodsIssueDate: "11 Aug 2026",
    goodsIssueQty: 1,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "12 Aug 2026",
    chainStatus: "Fully linked",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "On plan",
    exceptionTone: "success",
    valueZar: 98700,
    events: [
      { stage: "Requested", date: "01 Aug 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "03 Aug 2026", detail: "PR-71480 raised" },
      { stage: "On PO", date: "04 Aug 2026", detail: "PO-55500 issued" },
      { stage: "Received", date: "09 Aug 2026", detail: "GR posted, 1 EA" },
      { stage: "Issued", date: "11 Aug 2026", detail: "Goods issue against RS-810455/0010" },
      { stage: "Confirmed", date: "12 Aug 2026", detail: "Requester confirmed consumed, on plan" },
    ],
  },
  // N — awaiting confirmation, early-stage aging (matches the doc's "12d overdue" example)
  {
    id: "L-14",
    trackingId: "SPR-TRK-40268",
    reservationNumber: "RS-810468",
    reservationLine: "0010",
    materialCode: "500-33455",
    materialDescription: "Conveyor pulley bearing",
    plant: "Black Mountain",
    requester: "K. Sithole",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    purpose: "Pulley bearing replacement, CV-22 return idler",
    requirementDate: "05 Aug 2026",
    plannedConsumptionDate: "20 Aug 2026",
    requestedQty: 2,
    storeIssuedQty: 0,
    procurementQty: 2,
    uom: "EA",
    prNumber: "PR-71560",
    prAllocationType: "Direct",
    poNumber: "PO-55520",
    goodsReceiptDate: "12 Aug 2026",
    goodsReceiptQty: 2,
    goodsIssueDate: null,
    goodsIssueQty: 0,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Fully linked",
    agingDays: 12,
    agingBasis: "Planned consumption date",
    escalationStage: "Requester notified",
    exceptionLabel: "12d overdue",
    exceptionTone: "warning",
    valueZar: 27300,
    events: [
      { stage: "Requested", date: "05 Aug 2026", detail: "RR raised with consumption plan" },
      { stage: "Received", date: "12 Aug 2026", detail: "GR posted, 2 EA, still in stores" },
      { stage: "Aged", date: "20 Aug 2026", detail: "Planned consumption date breached, unissued" },
      { stage: "Requester notified", date: "21 Aug 2026", detail: "First aging alert sent" },
    ],
  },
  // O — second shared-allocation line on the same consolidated PR as L-06
  {
    id: "L-15",
    trackingId: "SPR-TRK-40123",
    reservationNumber: "RS-810323",
    reservationLine: "0010",
    materialCode: "500-40012",
    materialDescription: "Pressure transmitter 4-20mA",
    plant: "Black Mountain",
    requester: "N. Fourie",
    department: "Instrumentation",
    costCentre: "CC-2207-INST",
    purpose: "Replace transmitter, Thickener 2 overflow line",
    requirementDate: "20 Jul 2026",
    plannedConsumptionDate: "29 Jul 2026",
    requestedQty: 1,
    storeIssuedQty: 0,
    procurementQty: 1,
    uom: "EA",
    prNumber: "PR-71420",
    prAllocationType: "Shared allocation",
    allocationNote: "Second reservation pegged to the same consolidated PR-71420 as RS-810322/0010, allocated FIFO by requirement date.",
    poNumber: "PO-55420",
    goodsReceiptDate: "30 Jul 2026",
    goodsReceiptQty: 1,
    goodsIssueDate: "05 Aug 2026",
    goodsIssueQty: 1,
    utilisationStatus: "Confirmed consumed",
    utilisationConfirmedDate: "06 Aug 2026",
    chainStatus: "Shared allocation",
    agingDays: 0,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "On plan",
    exceptionTone: "success",
    valueZar: 22100,
    events: [
      { stage: "Requested", date: "20 Jul 2026", detail: "RR raised with consumption plan" },
      { stage: "On PR", date: "21 Jul 2026", detail: "Consolidated into PR-71420 alongside RS-810322/0010" },
      { stage: "Received", date: "30 Jul 2026", detail: "GR posted, allocated 1 EA to this line" },
      { stage: "Issued", date: "05 Aug 2026", detail: "Goods issue against RS-810323/0010" },
      { stage: "Confirmed", date: "06 Aug 2026", detail: "Requester confirmed consumed, on plan" },
    ],
  },
  // P — unreferenced offline issue, unresolved broken link
  {
    id: "L-16",
    trackingId: null,
    reservationNumber: "—",
    reservationLine: "—",
    materialCode: "500-20044",
    materialDescription: "Hydraulic hose assembly 25mm",
    plant: "Gamsberg",
    requester: "Unmatched",
    department: "—",
    purpose: "—",
    requirementDate: null,
    plannedConsumptionDate: null,
    requestedQty: 0,
    storeIssuedQty: 2,
    procurementQty: 0,
    uom: "EA",
    prNumber: null,
    prAllocationType: "None",
    poNumber: null,
    goodsReceiptDate: null,
    goodsReceiptQty: 0,
    goodsIssueDate: "22 Aug 2026",
    goodsIssueQty: 2,
    utilisationStatus: "Awaiting confirmation",
    utilisationConfirmedDate: null,
    chainStatus: "Broken link",
    reconciliationNote: "Offline issue-book entry — no matching reservation found; confidence below auto-match threshold.",
    agingDays: 10,
    agingBasis: "Not aging",
    escalationStage: "Not applicable",
    exceptionLabel: "Awaiting reconciliation",
    exceptionTone: "danger",
    valueZar: 8200,
    events: [
      { stage: "Issued", date: "22 Aug 2026", detail: "Offline issue-book entry posted, no reservation reference" },
      { stage: "Queued", date: "23 Aug 2026", detail: "Below auto-match confidence — queued for warehouse team review" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Aging & exception KPIs
// ---------------------------------------------------------------------------

export interface UtilisationKpiSummary {
  unutilisedValueZarMn: number
  unutilisedLineCount: number
  planCompliancePct: number
  planCaptureCompletePct: number
  redeployment: { count: number; potentialAvoidanceZar: number }
  ledgerIntegrityExceptionPct: number
}

/** Fixed baseline for the company-wide position, not derived from the small
 * ledger sample below — mirrors how the /dashboard KPI totals are curated
 * separately from the situation-analysis drill-down sample. The live
 * quantities below (redeployment, resolved exceptions) are layered on top so
 * KPI cards visibly move as the demo proceeds. */
const BASE_UNUTILISED_LINE_COUNT = 47
const BASE_PLAN_COMPLIANCE_PCT = 78.4
const BASE_PLAN_CAPTURE_COMPLETE_PCT = 94
const BASE_LEDGER_INTEGRITY_EXCEPTION_PCT = 9

export function computeUtilisationKpiSummary({
  recommendations,
  recommendationDecisions,
  resolvedExceptionCount,
  resolvedExceptionValueZarMn,
}: {
  recommendations: RedeploymentRecommendation[]
  recommendationDecisions: Record<string, "accepted" | "dismissed">
  resolvedExceptionCount: number
  resolvedExceptionValueZarMn: number
}): UtilisationKpiSummary {
  const undecided = recommendations.filter((r) => !recommendationDecisions[r.id])
  const baseUnutilisedValueZarMn = idleAgingTotalZarMn() + HISTORICAL_FALLBACK_AGING.valueZarMn

  return {
    unutilisedValueZarMn: Math.max(
      0,
      baseUnutilisedValueZarMn - resolvedExceptionValueZarMn
    ),
    unutilisedLineCount: Math.max(0, BASE_UNUTILISED_LINE_COUNT - resolvedExceptionCount),
    planCompliancePct: BASE_PLAN_COMPLIANCE_PCT,
    planCaptureCompletePct: BASE_PLAN_CAPTURE_COMPLETE_PCT,
    redeployment: {
      count: undecided.length,
      potentialAvoidanceZar: undecided.reduce((sum, r) => sum + r.avoidedBuyValue, 0),
    },
    ledgerIntegrityExceptionPct: BASE_LEDGER_INTEGRITY_EXCEPTION_PCT,
  }
}

// ---------------------------------------------------------------------------
// Utilisation aging — plan-backed (WATCH), by bucket and plant, in ZAR millions.
// Buckets are days past the planned consumption date, not days since GR.
// ---------------------------------------------------------------------------

export interface AgingBucket {
  bucket: string
  Gamsberg: number
  "Black Mountain": number
}

export const IDLE_AGING_BUCKETS: AgingBucket[] = [
  { bucket: "0–30d", Gamsberg: 0.95, "Black Mountain": 0.78 },
  { bucket: "31–60d", Gamsberg: 1.15, "Black Mountain": 0.98 },
  { bucket: "61–90d", Gamsberg: 0.82, "Black Mountain": 0.71 },
  { bucket: "90+d", Gamsberg: 1.42, "Black Mountain": 1.55 },
]

export function idleAgingTotalZarMn(): number {
  return IDLE_AGING_BUCKETS.reduce((sum, b) => sum + b.Gamsberg + b["Black Mountain"], 0)
}

export function idleAgingByPlantZarMn(): Record<UtilisationPlant, number> {
  return IDLE_AGING_BUCKETS.reduce(
    (acc, b) => {
      acc.Gamsberg += b.Gamsberg
      acc["Black Mountain"] += b["Black Mountain"]
      return acc
    },
    { Gamsberg: 0, "Black Mountain": 0 } as Record<UtilisationPlant, number>
  )
}

/**
 * Legacy stock that predates consumption-plan capture — aged from goods
 * receipt date plus a category grace period, kept visually distinct from
 * plan-backed aging above (source doc §3.3, "Historical Stock").
 */
export interface HistoricalFallbackSummary {
  valueZarMn: number
  lineCount: number
}

export const HISTORICAL_FALLBACK_AGING: HistoricalFallbackSummary = {
  valueZarMn: 0.62,
  lineCount: 5,
}

// ---------------------------------------------------------------------------
// Requester exception workflow — derived from ledger lines in an active
// escalation stage (Confirm Consumed / Delayed / No Longer Required loop).
// ---------------------------------------------------------------------------

export interface RequesterException {
  ledgerRowId: string
  materialCode: string
  description: string
  plant: UtilisationPlant
  requester: string
  plannedConsumptionDate: string
  statusLabel: string
}

const ACTIVE_ESCALATION_STAGES: EscalationStage[] = [
  "Requester notified",
  "Requester overdue",
  "HOD escalated",
  "Inventory control review",
]

export function getRequesterExceptions(
  ledger: UtilisationLedgerRow[] = UTILISATION_LEDGER
): RequesterException[] {
  return ledger
    .filter((r) => ACTIVE_ESCALATION_STAGES.includes(r.escalationStage))
    .map((r) => ({
      ledgerRowId: r.id,
      materialCode: r.materialCode,
      description: r.materialDescription,
      plant: r.plant,
      requester: r.requester,
      plannedConsumptionDate: r.plannedConsumptionDate ?? "Historical fallback",
      statusLabel: r.exceptionLabel,
    }))
}

// ---------------------------------------------------------------------------
// Live mutations — pure transforms applied to a ledger row by the client
// workspace, so every card that reads from the same ledger state stays
// consistent (a resolved exception disappears from the queue AND updates
// the row shown in the ledger table itself).
// ---------------------------------------------------------------------------

/** Fixed "today" for this mock's internal calendar, matching the ledger's own dates. */
export const MOCK_TODAY_LABEL = "01 Sep 2026"

export type ExceptionResponseAction = "confirmed" | "delayed" | "released"

export function applyExceptionResponse(
  row: UtilisationLedgerRow,
  action: ExceptionResponseAction,
  payload?: { newDate: string; reason: string }
): UtilisationLedgerRow {
  if (action === "confirmed") {
    return {
      ...row,
      utilisationStatus: "Confirmed consumed",
      utilisationConfirmedDate: MOCK_TODAY_LABEL,
      escalationStage: "Resolved",
      agingDays: 0,
      exceptionLabel: "Confirmed — resolved",
      exceptionTone: "success",
      events: [
        ...row.events,
        {
          stage: "Confirmed",
          date: MOCK_TODAY_LABEL,
          detail: `Requester confirmed consumed via exception response (was "${row.exceptionLabel}")`,
        },
      ],
    }
  }
  if (action === "released") {
    return {
      ...row,
      utilisationStatus: "No longer required",
      escalationStage: "Resolved",
      exceptionLabel: "Released for redeployment",
      exceptionTone: "success",
      events: [
        ...row.events,
        {
          stage: "Released",
          date: MOCK_TODAY_LABEL,
          detail: "Requester selected No Longer Required via exception response",
        },
      ],
    }
  }
  // delayed
  const newDateLabel = payload ? formatDateInputLabel(payload.newDate) : row.plannedConsumptionDate
  return {
    ...row,
    utilisationStatus: "Delayed",
    previousPlannedConsumptionDate: row.plannedConsumptionDate ?? undefined,
    plannedConsumptionDate: newDateLabel,
    replanReason: payload?.reason,
    escalationStage: "Not applicable",
    agingDays: 0,
    agingBasis: "Planned consumption date",
    exceptionLabel: `Re-planned — new date ${newDateLabel}`,
    exceptionTone: "default",
    events: [
      ...row.events,
      {
        stage: "Re-planned",
        date: MOCK_TODAY_LABEL,
        detail: `Requester selected Delayed — new date ${newDateLabel}, reason: ${payload?.reason ?? "not captured"}`,
      },
    ],
  }
}

export function applyRedeploymentAcceptance(row: UtilisationLedgerRow): UtilisationLedgerRow {
  return {
    ...row,
    exceptionLabel: "Transfer approved — pending SAP posting",
    exceptionTone: "default",
    events: [
      ...row.events,
      {
        stage: "Approved",
        date: MOCK_TODAY_LABEL,
        detail: "Redeployment recommendation accepted — transfer pending SAP posting by an authorised user",
      },
    ],
  }
}

/** "2026-10-01" (HTML date input value) -> "01 Oct 2026". */
function formatDateInputLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return formatDateDMY(new Date(year, month - 1, day))
}

// ---------------------------------------------------------------------------
// Redeployment & pre-order intelligence (ACT) — advisory, human-approved.
// ---------------------------------------------------------------------------

export type RedeploymentActionType = "Inter-plant transfer" | "Store draw" | "Reuse review"

export type RedeploymentSourceType =
  | "Sister-plant unused stock"
  | "Released — no longer required"
  | "Duplicate demand — same material"
  | "Approved alternate (Initiative 10)"

export interface RedeploymentRecommendation {
  id: string
  materialCode: string
  description: string
  alternateOfMaterialCode?: string
  sourceType: RedeploymentSourceType
  actionType: RedeploymentActionType
  idleUnits: number
  idlePlant: UtilisationPlant
  idleAgingDays: number
  demandPlant: UtilisationPlant
  demandRef: string
  avoidedBuyValue: number
  confidencePct: number
  ledgerRowId?: string
}

export const REDEPLOYMENT_RECOMMENDATIONS: RedeploymentRecommendation[] = [
  {
    id: "RD-01",
    materialCode: "500-82077",
    description: "SAG mill trunnion seal",
    sourceType: "Sister-plant unused stock",
    actionType: "Inter-plant transfer",
    idleUnits: 3,
    idlePlant: "Black Mountain",
    idleAgingDays: 134,
    demandPlant: "Gamsberg",
    demandRef: "PR-72010",
    avoidedBuyValue: 402000,
    confidencePct: 88,
    ledgerRowId: "L-10",
  },
  {
    id: "RD-02",
    materialCode: "500-58890",
    description: "Flotation cell rotor",
    sourceType: "Released — no longer required",
    actionType: "Inter-plant transfer",
    idleUnits: 2,
    idlePlant: "Gamsberg",
    idleAgingDays: 30,
    demandPlant: "Black Mountain",
    demandRef: "PR-72055",
    avoidedBuyValue: 268500,
    confidencePct: 82,
    ledgerRowId: "L-05",
  },
  {
    id: "RD-03",
    materialCode: "500-64410",
    description: "Slurry pump impeller",
    sourceType: "Duplicate demand — same material",
    actionType: "Inter-plant transfer",
    idleUnits: 4,
    idlePlant: "Black Mountain",
    idleAgingDays: 96,
    demandPlant: "Gamsberg",
    demandRef: "PR-72088",
    avoidedBuyValue: 187300,
    confidencePct: 79,
  },
  {
    id: "RD-04",
    materialCode: "500-40088",
    description: "Approved Tier 1 alternate pressure transmitter",
    alternateOfMaterialCode: "500-40012",
    sourceType: "Approved alternate (Initiative 10)",
    actionType: "Store draw",
    idleUnits: 6,
    idlePlant: "Gamsberg",
    idleAgingDays: 40,
    demandPlant: "Gamsberg",
    demandRef: "PR-72101",
    avoidedBuyValue: 92600,
    confidencePct: 91,
  },
  {
    id: "RD-05",
    materialCode: "500-33455",
    description: "Conveyor pulley bearing",
    sourceType: "Duplicate demand — same material",
    actionType: "Store draw",
    idleUnits: 5,
    idlePlant: "Black Mountain",
    idleAgingDays: 55,
    demandPlant: "Black Mountain",
    demandRef: "PR-72140",
    avoidedBuyValue: 68900,
    confidencePct: 69,
  },
]

// ---------------------------------------------------------------------------
// Requester accountability — unresolved OAR value by owner (company-wide).
// ---------------------------------------------------------------------------

export interface RequesterAccountabilityRow {
  requester: string
  department: string
  costCentre: string
  openExceptions: number
  unresolvedValueZar: number
  oldestOverdueDays: number
}

export const REQUESTER_ACCOUNTABILITY: RequesterAccountabilityRow[] = [
  {
    requester: "T. Mokoena",
    department: "Mining Maintenance",
    costCentre: "CC-4021-MILL",
    openExceptions: 3,
    unresolvedValueZar: 1120000,
    oldestOverdueDays: 150,
  },
  {
    requester: "S. van der Merwe",
    department: "Concentrator Operations",
    costCentre: "CC-3312-FLOT",
    openExceptions: 2,
    unresolvedValueZar: 845000,
    oldestOverdueDays: 88,
  },
  {
    requester: "K. Sithole",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    openExceptions: 2,
    unresolvedValueZar: 612000,
    oldestOverdueDays: 61,
  },
  {
    requester: "R. Naidoo",
    department: "Instrumentation",
    costCentre: "CC-2207-INST",
    openExceptions: 1,
    unresolvedValueZar: 398000,
    oldestOverdueDays: 34,
  },
  {
    requester: "L. Dlamini",
    department: "Concentrator Maintenance",
    costCentre: "CC-5108-CONV",
    openExceptions: 1,
    unresolvedValueZar: 271000,
    oldestOverdueDays: 22,
  },
]

// ---------------------------------------------------------------------------
// NM/SM inflow trend + reclassification candidates.
// ---------------------------------------------------------------------------

export interface NmSmTrendPoint {
  month: string
  valueZarMn: number
}

export const NM_SM_INFLOW_TREND: NmSmTrendPoint[] = [
  { month: "Feb 2026", valueZarMn: 3.4 },
  { month: "Mar 2026", valueZarMn: 3.1 },
  { month: "Apr 2026", valueZarMn: 2.7 },
  { month: "May 2026", valueZarMn: 2.5 },
  { month: "Jun 2026", valueZarMn: 2.0 },
  { month: "Jul 2026", valueZarMn: 1.6 },
  { month: "Aug 2026", valueZarMn: 1.2 },
]

export interface ReclassificationCandidate {
  materialCode: string
  description: string
  plant: UtilisationPlant | "Both"
  consumptionsLast12Mo: number
  note: string
}

export const RECLASSIFICATION_CANDIDATES: ReclassificationCandidate[] = [
  {
    materialCode: "500-40012",
    description: "Pressure transmitter 4-20mA",
    plant: "Black Mountain",
    consumptionsLast12Mo: 6,
    note: "6 issues in the last 12 months against an OAR planning category — review for order-to-stock conversion.",
  },
  {
    materialCode: "500-64410",
    description: "Slurry pump impeller",
    plant: "Both",
    consumptionsLast12Mo: 9,
    note: "9 issues across both plants in 12 months — the SOP's 4-per-year threshold is comfortably exceeded.",
  },
  {
    materialCode: "500-33455",
    description: "Conveyor pulley bearing",
    plant: "Black Mountain",
    consumptionsLast12Mo: 5,
    note: "5 issues in 12 months — borderline; recommend one more quarter of evidence before reclassifying.",
  },
]
