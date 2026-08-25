// Server-only: reads and parses src/lib/data/repair_register.csv once at
// module load. This module touches Node's `fs` — import it only from Server
// Components and pass the results down as props; never import it from a
// "use client" file.
import fs from "fs"
import path from "path"

import { parseCsvRecords } from "@/lib/csv"
import type {
  ChainStatus,
  ConditionAttestation,
  DeclarationStatus,
  FlaggedPr,
  PlatformAlert,
  RepairChain,
  RepairKpiSummary,
  RepairRegisterRow,
  RepairVsNewEvaluation,
  SapDocRef,
  VziUnit,
} from "@/lib/types"

const CSV_PATH = path.join(process.cwd(), "src/lib/data/repair_register.csv")

const ROWS: Record<string, string>[] = parseCsvRecords(
  fs.readFileSync(CSV_PATH, "utf-8")
)

const num = (v: string) => Number(v || 0)

function toChain(r: Record<string, string>): RepairChain {
  const quantityOut = num(r.quantity_out)
  const receivedQuantity = num(r.received_quantity)
  const document: SapDocRef = {
    docType: r.doc_type as SapDocRef["docType"],
    docNumber: r.doc_number,
    quantity: quantityOut,
    vendor: r.vendor,
    date: r.dispatch_date,
    expectedDelivery: r.expected_delivery,
    receivedQuantity,
  }
  return {
    id: r.doc_number,
    materialId: r.material_id,
    plant: r.plant as VziUnit,
    document,
    quantityOut,
    receivedQuantity,
    quantityUnderRepair: quantityOut - receivedQuantity,
    vendor: r.vendor,
    dispatchDate: r.dispatch_date,
    expectedDelivery: r.expected_delivery,
    daysOpen: num(r.days_open),
    status: r.chain_status as ChainStatus,
  }
}

const CHAINS: RepairChain[] = ROWS.filter((r) => r.section === "chain").map(
  toChain
)

export function getChainsForMaterial(
  materialId: string,
  plant?: VziUnit
): RepairChain[] {
  return CHAINS.filter(
    (c) => c.materialId === materialId && (!plant || c.plant === plant)
  )
}

function toRegisterRow(r: Record<string, string>): RepairRegisterRow {
  const chains = getChainsForMaterial(r.material_id)
  const quantityUnderRepair = chains.reduce(
    (sum, c) => sum + c.quantityUnderRepair,
    0
  )
  const maxDaysOpen = chains.reduce((max, c) => Math.max(max, c.daysOpen), 0)
  // Only one chain per material in this dataset ever has outstanding
  // quantity at once, so the "earliest" outstanding delivery is just that
  // chain's -- no date parsing required.
  const outstanding = chains.find((c) => c.quantityUnderRepair > 0)
  const stockOnHand = num(r.stock_on_hand)
  const reorderPoint = r.reorder_point ? num(r.reorder_point) : undefined

  return {
    materialId: r.material_id,
    description: r.description,
    plant: r.plant as VziUnit,
    stockOnHand,
    reorderPoint,
    atOrBelowRop: reorderPoint !== undefined && stockOnHand <= reorderPoint,
    chains,
    quantityUnderRepair,
    earliestExpectedDelivery: outstanding?.expectedDelivery,
    maxDaysOpen,
    declarationStatus: r.declaration_status as DeclarationStatus,
    valueZar: num(r.value_zar),
  }
}

export function getRepairRegister(filters?: {
  plant?: VziUnit
  vendor?: string
  declarationStatus?: DeclarationStatus
  chainStatus?: ChainStatus
}): RepairRegisterRow[] {
  return ROWS.filter((r) => r.section === "register")
    .map(toRegisterRow)
    .filter((row) => {
      if (filters?.plant && row.plant !== filters.plant) return false
      if (
        filters?.declarationStatus &&
        row.declarationStatus !== filters.declarationStatus
      )
        return false
      if (
        filters?.chainStatus &&
        !row.chains.some((c) => c.status === filters.chainStatus)
      )
        return false
      if (
        filters?.vendor &&
        !row.chains.some((c) => c.vendor === filters.vendor)
      )
        return false
      return true
    })
}

function toFlaggedPr(r: Record<string, string>): FlaggedPr {
  return {
    prNumber: r.pr_number,
    materialId: r.material_id,
    plant: r.plant as VziUnit,
    quantity: num(r.quantity_out),
    generatedDate: r.generated_date,
    daysFlagged: num(r.days_flagged),
    collidingChainId: r.colliding_chain_id || undefined,
    declarationStatus: r.declaration_status as DeclarationStatus,
  }
}

export function getFlaggedPrs(): FlaggedPr[] {
  return ROWS.filter((r) => r.section === "flagged_pr").map(toFlaggedPr)
}

function chainContextSnapshot(materialId: string): string {
  const active = getChainsForMaterial(materialId).find(
    (c) => c.quantityUnderRepair > 0
  )
  if (!active) return "No open repair chain at the time of declaration."
  return `${active.document.docNumber}: ${active.quantityUnderRepair} of ${active.quantityOut} units still at ${active.vendor}, expected ${active.expectedDelivery}.`
}

function toDeclaration(
  r: Record<string, string>,
  index: number
): ConditionAttestation {
  return {
    id: `decl-${index + 1}`,
    prNumber: r.pr_number,
    materialId: r.material_id,
    plant: r.plant as VziUnit,
    declaredBy: r.declared_by,
    declaredAt: r.declared_at,
    statement: r.statement,
    note: r.note || undefined,
    chainContextSnapshot: chainContextSnapshot(r.material_id),
    decision: r.decision as ConditionAttestation["decision"],
  }
}

const DECLARATIONS: ConditionAttestation[] = ROWS.filter(
  (r) => r.section === "declaration"
).map(toDeclaration)

export function getDeclarations(): ConditionAttestation[] {
  return DECLARATIONS
}

export function getDeclarationsForMaterial(
  materialId: string
): ConditionAttestation[] {
  return DECLARATIONS.filter((d) => d.materialId === materialId)
}

function toEvaluation(r: Record<string, string>): RepairVsNewEvaluation {
  const active =
    getChainsForMaterial(r.material_id).find((c) => c.quantityUnderRepair > 0) ??
    getChainsForMaterial(r.material_id)[0]
  return {
    materialId: r.material_id,
    repairCost: num(r.repair_cost),
    repairRemainingDays: num(r.repair_remaining_days),
    repairExpectedReturn: active?.expectedDelivery ?? "",
    newUnitPrice: num(r.new_unit_price),
    newUnitLeadDays: num(r.new_unit_lead_days),
    recommendation: r.recommendation as RepairVsNewEvaluation["recommendation"],
    rationale: r.rationale,
  }
}

const EVALUATIONS: RepairVsNewEvaluation[] = ROWS.filter(
  (r) => r.section === "evaluation"
).map(toEvaluation)

export function getRepairVsNewEvaluation(
  materialId: string
): RepairVsNewEvaluation | undefined {
  return EVALUATIONS.find((e) => e.materialId === materialId)
}

export function getRepairKpiSummary(): RepairKpiSummary {
  const register = getRepairRegister()
  return {
    // Headline figures reflect the Initiative 8 report's "over 150 items are
    // out for repair at any given time" and VZI_CATEGORIES' Repair PR count
    // (99 Gamsberg + 76 BMM = 175) -- the company-wide population, of which
    // the register below models a representative sample from the 24-material
    // demo catalog.
    itemsOutForRepair: 154,
    unitsAtVendors: 238,
    valueOutForRepair: 9850000,
    chainsOverdue: register.reduce(
      (sum, row) =>
        sum + row.chains.filter((c) => c.status === "Overdue").length,
      0
    ),
    declarationsPending: register.filter(
      (row) => row.declarationStatus === "Pending"
    ).length,
  }
}

export function getRepairAlerts(): PlatformAlert[] {
  const duplicateAlerts: PlatformAlert[] = getFlaggedPrs().map((pr) => ({
    id: `repair-dup-${pr.prNumber}`,
    kind: "duplicate-repair-chain",
    initiative: "I8",
    severity: "warning",
    title: `Possible duplicate: ${pr.materialId}`,
    detail: `${pr.prNumber} was raised while a repair chain for this material is still open.`,
    raisedAt: pr.generatedDate,
    href: `/repairables/request/${pr.materialId}`,
    daysOpen: pr.daysFlagged,
  }))

  const overdueAlerts: PlatformAlert[] = getRepairRegister()
    .filter((row) => row.chains.some((c) => c.status === "Overdue"))
    .map((row) => ({
      id: `repair-overdue-${row.materialId}`,
      kind: "declaration-pending",
      initiative: "I8",
      severity: "critical",
      title: `Repair overdue: ${row.materialId}`,
      detail: `${row.description} has been at the vendor ${row.maxDaysOpen} days -- past the expected return date.`,
      raisedAt: row.earliestExpectedDelivery ?? "",
      href: `/repairables/${row.materialId}`,
      daysOpen: row.maxDaysOpen,
    }))

  return [...duplicateAlerts, ...overdueAlerts]
}
