// Initiative 8 — Refurbishable Spares Tracking (/refurbishables).
//
// Interfaces are colocated here rather than in types.ts: this initiative's
// scope is deliberately narrow (80-series detection, condition-to-repair
// attestation, repair status register) and nothing else in the app consumes
// these shapes.
//
// The register is READ-ONLY over SAP. Repair POs, goods movements and material
// coding are SAP transactions executed by VZI — the platform mirrors them, it
// never writes back. Figures are mock/illustrative, dated against a
// 01 Sep 2026 snapshot.
import type { VziUnit } from "@/lib/types"
import type { SeverityTone } from "@/lib/utils"

/** Lifecycle a serialised refurbishable item walks, in order. */
export const REPAIR_STAGES = [
  "Removed",
  "Attested",
  "Assessed/Stripped",
  "Sent to vendor",
  "In repair",
  "Returned (GR)",
  "Back in stock",
] as const

export type RepairStage = (typeof REPAIR_STAGES)[number]

/** Who performs the strip/assess, declared on the attestation. */
export type StripOption = "Internal team" | "Vendor assessment"

export interface RefurbishableItem {
  id: string
  /** 80-series stock code, format 8000000363 */
  materialCode: string
  description: string
  plant: VziUnit
  serialNo: string
  repairVendor: string
  /** SAP repair PO — null until the item is actually sent to the vendor. */
  repairPoRef: string | null
  stage: RepairStage
  /** Days since removal; frozen at total turnaround once back in stock. */
  daysOut: number
  valueZar: number
  removedOn: string // "DD MMM YYYY"
  removedBy: string
  removedByRole: string
  removalReason: string
  /** False = condition-to-repair declaration outstanding, item is blocked. */
  attested: boolean
  attestedOn: string | null
  stripBy: StripOption | null
  conditionNotes: string | null
  /** Date the loop closed — set only on "Back in stock". */
  closedOn: string | null
}

/** Non-80-series material showing a repair pattern — advisory coding candidate. */
export interface CodingCandidate {
  materialCode: string
  description: string
  plant: VziUnit
  /** Repair-type POs raised against this material in the last 24 months. */
  repairCount24m: number
  suggestedAction: string
}

export interface DetectionSummary {
  eightySeriesDetected: number
  codingCandidatesFlagged: number
  scanNote: string
}

export interface RepairLoopSummary {
  avgTurnaroundDays: number
  targetTurnaroundDays: number
  loopsClosedLast12Months: number
}

// ---------------------------------------------------------------------------
// Thresholds and derivations
// ---------------------------------------------------------------------------

export const AGING_AMBER_DAYS = 60
export const AGING_RED_DAYS = 90
export const ATTESTATION_TARGET_PCT = 95

export function stageIndex(stage: RepairStage): number {
  return REPAIR_STAGES.indexOf(stage)
}

/** An item is in the repair loop until it is booked back into stock. */
export function isInRepairLoop(item: RefurbishableItem): boolean {
  return item.stage !== "Back in stock"
}

/**
 * Aging severity on days out: >60 amber, >90 red. Closed loops carry no flag —
 * their days-out figure is a turnaround result, not an open exposure.
 */
export function repairAgingTone(item: RefurbishableItem): SeverityTone {
  if (!isInRepairLoop(item)) return "default"
  if (item.daysOut > AGING_RED_DAYS) return "danger"
  if (item.daysOut > AGING_AMBER_DAYS) return "warning"
  return "default"
}

export function isOverdue(item: RefurbishableItem): boolean {
  return repairAgingTone(item) !== "default"
}

/** Un-attested items never leave "Removed" — the declaration gates the loop. */
export function isAwaitingAttestation(item: RefurbishableItem): boolean {
  return !item.attested
}

// ---------------------------------------------------------------------------
// Repair status register — 14 serialised items across Gamsberg and BMM
// ---------------------------------------------------------------------------

export const REFURBISHABLE_ITEMS: RefurbishableItem[] = [
  {
    id: "REF-0418",
    materialCode: "8000000363",
    description: '11" GUIDE (DOLLY) WHEEL',
    plant: "Gamsberg",
    serialNo: "SN-GB-1184",
    repairVendor: "Reng Gopro",
    repairPoRef: null,
    stage: "Removed",
    daysOut: 8,
    valueZar: 38500,
    removedOn: "24 Aug 2026",
    removedBy: "T. Mokoena",
    removedByRole: "Mining Maintenance",
    removalReason: "Bearing seized — wheel locked on dolly frame",
    attested: false,
    attestedOn: null,
    stripBy: null,
    conditionNotes: null,
    closedOn: null,
  },
  {
    id: "REF-0421",
    materialCode: "8000001542",
    description: "BRAKE ASSY WET DISC FRONT",
    plant: "BMM",
    serialNo: "SN-BM-0772",
    repairVendor: "Aard Mining Equipment",
    repairPoRef: null,
    stage: "Removed",
    daysOut: 21,
    valueZar: 288400,
    removedOn: "11 Aug 2026",
    removedBy: "S. Naidoo",
    removedByRole: "LHD Workshop",
    removalReason: "Brake pack worn beyond service limit",
    attested: false,
    attestedOn: null,
    stripBy: null,
    conditionNotes: null,
    closedOn: null,
  },
  {
    id: "REF-0409",
    materialCode: "8000002471",
    description: "MOTOR ELEC 75KW 525V 4POLE",
    plant: "Gamsberg",
    serialNo: "SN-GB-0934",
    repairVendor: "Springbok Motor Rewinds",
    repairPoRef: null,
    stage: "Removed",
    daysOut: 91,
    valueZar: 214500,
    removedOn: "02 Jun 2026",
    removedBy: "P. van Wyk",
    removedByRole: "Plant Electrical",
    removalReason: "Winding insulation failure — IR test fail at 0.8 MΩ",
    attested: false,
    attestedOn: null,
    stripBy: null,
    conditionNotes: null,
    closedOn: null,
  },
  {
    id: "REF-0424",
    materialCode: "8000000014",
    description: "BARREL ASSY PUMP C5-ENVIROTECH",
    plant: "Gamsberg",
    serialNo: "SN-GB-2207",
    repairVendor: "Cape Mining Supplies",
    repairPoRef: null,
    stage: "Attested",
    daysOut: 6,
    valueZar: 62400,
    removedOn: "26 Aug 2026",
    removedBy: "L. Dlamini",
    removedByRole: "Concentrator",
    removalReason: "Seal leak — loss of discharge pressure",
    attested: true,
    attestedOn: "27 Aug 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Barrel bore scored on drive end, liner salvageable. Strip on site before quote.",
    closedOn: null,
  },
  {
    id: "REF-0402",
    materialCode: "8000002465",
    description: "MOTOR ELEC 45KW 525V",
    plant: "BMM",
    serialNo: "SN-BM-1461",
    repairVendor: "Springbok Motor Rewinds",
    repairPoRef: null,
    stage: "Assessed/Stripped",
    daysOut: 33,
    valueZar: 148900,
    removedOn: "30 Jul 2026",
    removedBy: "K. Bezuidenhout",
    removedByRole: "Plant Electrical",
    removalReason: "High vibration trip — drive-end bearing failure",
    attested: true,
    attestedOn: "31 Jul 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Rotor true, stator windings discoloured at slot exit. Rewind expected, frame reusable.",
    closedOn: null,
  },
  {
    id: "REF-0399",
    materialCode: "8000000047",
    description: "PUMP ASSY SLURRY 6/4 WARMAN",
    plant: "Gamsberg",
    serialNo: "SN-GB-0518",
    repairVendor: "Cape Mining Supplies",
    repairPoRef: null,
    stage: "Assessed/Stripped",
    daysOut: 42,
    valueZar: 132750,
    removedOn: "21 Jul 2026",
    removedBy: "L. Dlamini",
    removedByRole: "Concentrator",
    removalReason: "Casing wear — throughput loss on cyclone feed",
    attested: true,
    attestedOn: "22 Jul 2026",
    stripBy: "Vendor assessment",
    conditionNotes:
      "Volute wall thinned past wear plate, impeller vanes eroded. Vendor to strip and quote.",
    closedOn: null,
  },
  {
    id: "REF-0388",
    materialCode: "8000000023",
    description: "AXLE HURTH 112/260",
    plant: "BMM",
    serialNo: "SN-BM-0341",
    repairVendor: "Aard Mining Equipment",
    repairPoRef: "PO-71204",
    stage: "Sent to vendor",
    daysOut: 51,
    valueZar: 512600,
    removedOn: "12 Jul 2026",
    removedBy: "S. Naidoo",
    removedByRole: "LHD Workshop",
    removalReason: "Differential noise — metal fines in oil sample",
    attested: true,
    attestedOn: "13 Jul 2026",
    stripBy: "Vendor assessment",
    conditionNotes:
      "Crown wheel pitting visible through inspection port. Housing sound, no impact damage.",
    closedOn: null,
  },
  {
    id: "REF-0393",
    materialCode: "8000000991",
    description: "HYDRAULIC CYLINDER DUMP RH",
    plant: "Gamsberg",
    serialNo: "SN-GB-1622",
    repairVendor: "ABCO Engineering",
    repairPoRef: "PO-71219",
    stage: "Sent to vendor",
    daysOut: 26,
    valueZar: 176800,
    removedOn: "06 Aug 2026",
    removedBy: "T. Mokoena",
    removedByRole: "Mining Maintenance",
    removalReason: "Rod seal blown — cylinder drifting under load",
    attested: true,
    attestedOn: "07 Aug 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Rod chrome lifted 300 mm from gland. Barrel measured within tolerance after strip.",
    closedOn: null,
  },
  {
    id: "REF-0371",
    materialCode: "8000001187",
    description: "ROCK DRILL HL820ST",
    plant: "Gamsberg",
    serialNo: "SN-GB-0207",
    repairVendor: "Sandvik Mining RSA",
    repairPoRef: "PO-71098",
    stage: "In repair",
    daysOut: 106,
    valueZar: 941200,
    removedOn: "18 May 2026",
    removedBy: "J. Coetzee",
    removedByRole: "Drill & Blast",
    removalReason: "Loss of percussion pressure — piston scored",
    attested: true,
    attestedOn: "19 May 2026",
    stripBy: "Vendor assessment",
    conditionNotes:
      "Percussion piston and cylinder both scored. Shank adapter to be replaced, not repaired.",
    closedOn: null,
  },
  {
    id: "REF-0377",
    materialCode: "8000002102",
    description: "GEARBOX ASSY DRILL FEED",
    plant: "BMM",
    serialNo: "SN-BM-0899",
    repairVendor: "Sandvik Mining RSA",
    repairPoRef: "PO-71131",
    stage: "In repair",
    daysOut: 79,
    valueZar: 655400,
    removedOn: "14 Jun 2026",
    removedBy: "J. Coetzee",
    removedByRole: "Drill & Blast",
    removalReason: "Feed chain jam — output shaft bearing collapse",
    attested: true,
    attestedOn: "16 Jun 2026",
    stripBy: "Vendor assessment",
    conditionNotes:
      "Output bearing race broken up, debris through gear set. Casing to be crack-tested.",
    closedOn: null,
  },
  {
    id: "REF-0381",
    materialCode: "8000000988",
    description: "HYDRAULIC CYLINDER BOOM LH",
    plant: "BMM",
    serialNo: "SN-BM-1503",
    repairVendor: "ABCO Engineering",
    repairPoRef: "PO-71156",
    stage: "In repair",
    daysOut: 59,
    valueZar: 168300,
    removedOn: "04 Jul 2026",
    removedBy: "S. Naidoo",
    removedByRole: "LHD Workshop",
    removalReason: "Barrel scored after pin bush failure",
    attested: true,
    attestedOn: "05 Jul 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Bush failure allowed side load; barrel honed on assessment, rod straight.",
    closedOn: null,
  },
  {
    id: "REF-0386",
    materialCode: "8000001765",
    description: "BOOM ATTACHMENT ASSY LHD 14T",
    plant: "Gamsberg",
    serialNo: "SN-GB-0745",
    repairVendor: "Reliance Attachment",
    repairPoRef: "PO-71177",
    stage: "In repair",
    daysOut: 127,
    valueZar: 402900,
    removedOn: "27 Apr 2026",
    removedBy: "T. Mokoena",
    removedByRole: "Mining Maintenance",
    removalReason: "Weld cracking at lift arm boss",
    attested: true,
    attestedOn: "29 Apr 2026",
    stripBy: "Vendor assessment",
    conditionNotes:
      "Cracking both sides of boss, 180 mm each. Full re-plate and stress relief quoted.",
    closedOn: null,
  },
  {
    id: "REF-0364",
    materialCode: "8000001549",
    description: "BRAKE CALIPER ASSY REAR AXLE",
    plant: "BMM",
    serialNo: "SN-BM-0620",
    repairVendor: "Aard Mining Equipment",
    repairPoRef: "PO-71042",
    stage: "Returned (GR)",
    daysOut: 47,
    valueZar: 96700,
    removedOn: "16 Jul 2026",
    removedBy: "S. Naidoo",
    removedByRole: "LHD Workshop",
    removalReason: "Caliper seized — dragging on rear axle",
    attested: true,
    attestedOn: "17 Jul 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Piston corroded in bore, seals perished. Body sound. GR booked 28 Aug 2026.",
    closedOn: null,
  },
  {
    id: "REF-0352",
    materialCode: "8000000372",
    description: 'GUIDE WHEEL ASSY 14" DOLLY',
    plant: "Gamsberg",
    serialNo: "SN-GB-1091",
    repairVendor: "Reng Gopro",
    repairPoRef: "PO-70988",
    stage: "Back in stock",
    daysOut: 37,
    valueZar: 41800,
    removedOn: "01 Jun 2026",
    removedBy: "T. Mokoena",
    removedByRole: "Mining Maintenance",
    removalReason: "Flange wear beyond limit on dolly track",
    attested: true,
    attestedOn: "02 Jun 2026",
    stripBy: "Internal team",
    conditionNotes:
      "Flange built up and re-machined, new bearing set fitted. Back in serviceable stock.",
    closedOn: "08 Jul 2026",
  },
]

// ---------------------------------------------------------------------------
// 80-series detection
// ---------------------------------------------------------------------------

export const DETECTION_SUMMARY: DetectionSummary = {
  eightySeriesDetected: 1284,
  codingCandidatesFlagged: 37,
  scanNote:
    "Gamsberg + BMM material master scanned against 24 months of repair-type PO history.",
}

export const CODING_CANDIDATES: CodingCandidate[] = [
  {
    materialCode: "4000118427",
    description: "MOTOR ELEC 22KW 525V 4POLE",
    plant: "BMM",
    repairCount24m: 9,
    suggestedAction: "Review for 80-series coding",
  },
  {
    materialCode: "4000097315",
    description: "CYLINDER ASSY STEERING LHD",
    plant: "Gamsberg",
    repairCount24m: 7,
    suggestedAction: "Review for 80-series coding",
  },
  {
    materialCode: "4000132880",
    description: "PUMP ASSY VERTICAL SPINDLE",
    plant: "Gamsberg",
    repairCount24m: 6,
    suggestedAction: "Review for 80-series coding",
  },
  {
    materialCode: "4000105642",
    description: "GEARBOX ASSY CONVEYOR DRIVE",
    plant: "BMM",
    repairCount24m: 5,
    suggestedAction: "Review for 80-series coding",
  },
  {
    materialCode: "4000121079",
    description: "VALVE BANK ASSY DRILL RIG",
    plant: "BMM",
    repairCount24m: 4,
    suggestedAction: "Review for 80-series coding",
  },
]

/**
 * Turnaround is quoted over loops closed in the last 12 months, not over the
 * 14 register rows — one closed row is too thin a basis for an average.
 */
export const REPAIR_LOOP_SUMMARY: RepairLoopSummary = {
  avgTurnaroundDays: 74,
  targetTurnaroundDays: 45,
  loopsClosedLast12Months: 68,
}
