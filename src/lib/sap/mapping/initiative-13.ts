// W2.6b — Initiative 13: SAP reservations + platform plans -> the
// UtilizationLedgerLine view model.
//
// This is the initiative most exposed to §1.3: ReservationItemSet is the
// backbone of every consumption plan and it returns ZERO rows live. The
// mapping is written against real, measured property names, but it cannot be
// validated against real values until SAP answers why that set is empty.

import type { LedgerStage, UtilizationLedgerLine } from "@/features/initiative-13/types/oar"
import type { SapRow } from "../client/decode-row"
import { loadPlatform, type PlatformRow } from "./platform-source"
import { personRef, plantRef } from "./reference-data"
import type { FieldSourceMap } from "./field-source"

export const LEDGER_LINE_SOURCES: FieldSourceMap<UtilizationLedgerLine> = {
  id: { from: "platform", file: "consumption_plans", column: "plan_id" },
  trackingId: { from: "platform", file: "consumption_plans", column: "session_id" },
  reservation: {
    from: "blocked",
    entitySet: "ReservationItemSet",
    property: "Rsnum/Rspos",
    note: "real property names, confirmed. Zero rows live (§1.3), so plan rows carry the numbers today",
  },
  material: {
    from: "sap",
    entitySet: "MaterialSet",
    property: "Matnr",
    note: "description joined from MaterialDescriptionSet.Maktx",
  },
  plant: {
    from: "sap",
    entitySet: "MaterialPlantSet",
    property: "Werks",
    note: "the CODE is real; the site NAME is not - no exposed SAP field maps Werks to a mine site, and SAP has 5 plant codes against the app's 3 named plants. See reference-data.ts",
  },
  qtyRequested: {
    from: "blocked",
    entitySet: "ReservationItemSet",
    property: "Bdmng",
    note: "requirement quantity. Zero rows live; consumption_plans.planned_quantity stands in",
  },
  qtyIssued: {
    from: "blocked",
    entitySet: "ReservationItemSet",
    property: "Enmng",
    note: "quantity withdrawn. Zero rows live (§1.3)",
  },
  plannedConsumptionDate: {
    from: "blocked",
    entitySet: "ReservationItemSet",
    property: "Bdter",
    note: "requirement date. Zero rows live; consumption_plans.planned_use_date stands in",
  },
  uom: { from: "blocked", entitySet: "ReservationItemSet", property: "Meins", note: "zero rows live (§1.3)" },
  qtyConfirmedUsed: { from: "platform", file: "utilisation_status", column: "confirmed_used" },
  requester: {
    from: "platform",
    file: "consumption_plans",
    column: "requester",
    note: "the requester ID is real; mapping it to a named user is not - platform data carries VZIREQ01..05 with no link to the app's user catalogue. See reference-data.ts",
  },
  purpose: { from: "platform", file: "consumption_plans", column: "purpose" },
  stage: { from: "derived", note: "from the utilisation status plus which SAP documents exist in the chain" },
  exception: {
    from: "platform",
    file: "exceptions",
    column: "exception_type",
    note: "Consumption Overdue / No Longer Required",
  },
  replanReason: { from: "platform", file: "utilisation_status", column: "reason" },
  replanNewDate: { from: "platform", file: "utilisation_status", column: "replanned_date" },
  agingDays: { from: "derived", note: "days between the planned consumption date and today" },
  documentChain: {
    from: "derived",
    note: "assembled from the reservation, its PR (Banfn/Bnfpo), the PO, and goods movements",
  },
  qtyReceived: {
    from: "blocked",
    entitySet: "GoodsMovementItemSet",
    note: "goods-receipt quantity against the PR/PO. Needs the movement-type set confirmed — still a pending business constant",
  },
  unitPrice: {
    from: "blocked",
    entitySet: "MaterialValuationSet",
    property: "Verpr",
    note: "zero rows live (§1.3)",
  },

  // ---- Genuine gaps ----
  department: {
    from: "gap",
    note: "Requester's department. Not on the reservation and not in any platform file. Would come from an HR/user directory, which this system does not have.",
  },
  project: {
    from: "gap",
    note: "Project reference. RESB has no project field in the exposed projection. If VZI wants it, it is an exposure request.",
  },
  jobWorkOrder: {
    from: "gap",
    note: "Work-order reference. ReservationItemSet.Aufnr (order number) IS exposed and is the obvious candidate — but confirm with VZI that Aufnr is what this field means before wiring it.",
  },
  equipment: {
    from: "gap",
    note: "Equipment reference. No exposed source; would need EQUI/technical-object data that is not in either service.",
  },
  allocationMethod: {
    from: "gap",
    note: "How a consolidated PR/PO splits across requesters (Scenario H). A platform concept with no producer yet.",
  },
  consolidatedGroupId: {
    from: "gap",
    note: "Groups ledger lines rolled into a shared PR/PO. Same as above — a platform concept nothing currently emits.",
  },
}

export interface Initiative13Input {
  plans: PlatformRow[]
  utilisation: Map<string, PlatformRow>
  exceptions: PlatformRow[]
  descriptions: Map<string, string>
  /** ReservationItemSet keyed by `Rsnum|Rspos`. Empty against live SAP today (§1.3). */
  reservations?: Map<string, SapRow>
}

const numberOf = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const asDateString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value ? String(value).slice(0, 10) : ""
}

function stageFor(status: string, hasReservation: boolean): LedgerStage {
  switch (status) {
    case "CONFIRMED_USED":
      return "Utilization Confirmed"
    case "ISSUED":
      return "Goods Issued"
    case "RECEIVED":
      return "Goods Receipt"
    case "NO_LONGER_REQUIRED":
      return "Available for Redeployment"
    case "AWAITING_USE":
      return hasReservation ? "Reserved" : "Requested"
    default:
      return "Requested"
  }
}

export function mapLedgerLine(
  plan: PlatformRow,
  input: Initiative13Input,
  asOf = new Date()
): UtilizationLedgerLine {
  const key = `${plan.Rsnum}|${plan.Rspos}`
  const reservation = input.reservations?.get(key)
  const status = input.utilisation.get(key)
  const exception = input.exceptions.find((e) => e.object_reference === plan.plan_id)

  const plannedDate = reservation
    ? asDateString(reservation.Bdter)
    : plan.planned_use_date

  return {
    id: plan.plan_id,
    trackingId: plan.session_id,
    reservation: { type: "RESERVATION", documentNumber: plan.Rsnum, line: plan.Rspos },
    material: {
      materialId: plan.Matnr,
      materialCode: plan.Matnr,
      description: input.descriptions.get(plan.Matnr) ?? "",
    },
    plant: plantRef(plan.Werks),
    requester: personRef(plan.requester),
    purpose: plan.purpose,
    plannedConsumptionDate: plannedDate,
    qtyRequested: reservation ? numberOf(reservation.Bdmng) : numberOf(plan.planned_quantity),
    qtyIssued: reservation ? numberOf(reservation.Enmng) : 0,
    qtyConfirmedUsed: status?.confirmed_used === "true" ? numberOf(plan.planned_quantity) : 0,
    uom: reservation ? String(reservation.Meins ?? "") : "EA",
    stage: stageFor(status?.status ?? "", Boolean(reservation)),
    agingDays: plannedDate ? Math.round((asOf.getTime() - new Date(plannedDate).getTime()) / 86_400_000) : 0,
    exception:
      exception?.exception_type === "CONSUMPTION_OVERDUE"
        ? "Consumption Overdue"
        : exception?.exception_type === "NO_LONGER_REQUIRED"
          ? "No Longer Required"
          : "None",
    documentChain: [],
    replanReason: status?.reason || undefined,
    replanNewDate: status?.replanned_date || undefined,

    // Blocked on §1.3 / pending business constants — see LEDGER_LINE_SOURCES.
    qtyReceived: 0,
    unitPrice: 0,

    // Gaps. Deliberately absent rather than invented.
    department: "",
  }
}

export function loadInitiative13Platform(): Initiative13Input {
  const utilisation = new Map(
    loadPlatform("utilisation_status").map((row) => [`${row.Rsnum}|${row.Rspos}`, row])
  )
  return {
    plans: loadPlatform("consumption_plans"),
    utilisation,
    exceptions: loadPlatform("exceptions"),
    descriptions: new Map(),
  }
}
