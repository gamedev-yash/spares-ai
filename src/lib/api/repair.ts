// Initiative 8 -- refurbishable spares tracking: the repair register, the duplicate
// guard, and condition-to-repair declarations.
import { apiFetch } from "@/lib/api/client"

/** One open repair chain: a unit that is out at a vendor (or waiting to go). */
export interface RepairChain {
  material_id: number
  material_code: string | null
  material_description: string | null
  material_group: string | null
  plant: string | null
  repair_pr_number: string | null
  repair_pr_id: number | null
  repair_po_number: string | null
  repair_po_id: number | null
  supplier_id: number | null
  vendor: string | null
  quantity_under_repair: number
  repair_value: number
  opened_at: string | null
  expected_return: string | null
  days_open: number | null
  days_overdue: number
  overdue: boolean
  stage: string | null
}

/** A register row: the chain, plus the inventory position beside it. */
export interface RepairRegisterRow extends RepairChain {
  stock_on_hand: number
  unit_of_measure: string | null
  reorder_point: number | null
  reorder_triggered: boolean
  criticality: string | null
  new_unit_cost: number
  new_lead_time_days: number
  declarations_pending: number
  declarations_complete: number
  duplicate_risk: boolean
}

export interface RepairRegisterSummary {
  open_chain_count: number
  total_quantity_under_repair: number
  total_value_under_repair: number
  overdue_count: number
  reorder_triggered_count: number
  duplicate_risk_count: number
  pending_declaration_count: number
  average_days_open: number | null
}

export interface RepairRegister {
  items: RepairRegisterRow[]
  summary: RepairRegisterSummary
  total: number
}

export interface EconomicEvaluation {
  material_id: number
  material_code: string | null
  material_description: string | null
  plant: string | null
  quantity: number
  repair_total_cost: number
  repair_cost_basis: string
  repair_reference: string | null
  repair_vendor: string | null
  repair_expected_return: string | null
  repair_days_until_return: number | null
  repair_is_overdue: boolean
  new_total_cost: number
  new_unit_cost: number
  new_lead_time_days: number
  saving_if_repair_used: number
  saving_pct: number | null
  repair_arrives_sooner: boolean
}

/** What the guard reports before a new-buy requisition is raised. Advisory only. */
export interface DuplicateCheck {
  material_id: number
  material_code: string | null
  material_description: string | null
  plant: string | null
  is_repairable: boolean
  has_active_chain: boolean
  total_quantity_under_repair: number
  earliest_expected_return: string | null
  chains: RepairChain[]
  economics: EconomicEvaluation | null
  attestation_required: boolean
  attestation_statement: string | null
}

export interface Attestation {
  id: number
  rr_id: number | null
  rr_number: string | null
  rr_status: string | null
  material_id: number | null
  material_code: string | null
  material_description: string | null
  plant: string | null
  origin: "MANUAL" | "MRP" | "CHAT" | null
  status: "COMPLETE" | "PENDING" | null
  statement: string | null
  declared_by: number | null
  declared_by_name: string | null
  declared_at: string | null
  created_at: string | null
  duplicate_flag: boolean
  chain_snapshot: DuplicateContext | null
}

export interface PendingDeclaration {
  attestation_id: number
  rr_id: number
  rr_number: string | null
  rr_status: string | null
  plant: string | null
  department: string | null
  priority: string | null
  trigger_type: string | null
  origin: string | null
  material_id: number | null
  material_code: string | null
  material_description: string | null
  requester: string | null
  created_at: string | null
  duplicate_flag: boolean
  chain_snapshot: DuplicateContext | null
}

/** The shape stored on a flagged RR/PR and shown to the approver. Written identically by
 * the data generator and by rr_service at runtime. */
export interface DuplicateContext {
  detected_at: string
  plant: string | null
  chain_count: number
  materials: {
    material_id: number
    material_code: string | null
    material_description: string | null
    plant: string | null
    total_quantity_under_repair: number
    earliest_expected_return: string | null
    chains: RepairChain[]
  }[]
}

export interface RegisterParams {
  plant?: string
  status?: "OVERDUE" | "IN_FLIGHT" | "REORDER_TRIGGERED"
  material_group?: string
  search?: string
  [key: string]: string | number | boolean | undefined
}

export function getRepairRegister(params: RegisterParams = {}): Promise<RepairRegister> {
  return apiFetch<RepairRegister>("/repair/register", { params })
}

export function getRepairPlants(): Promise<string[]> {
  return apiFetch<string[]>("/repair/register/plants")
}

export function checkRepairChain(materialId: number, plant?: string): Promise<DuplicateCheck> {
  return apiFetch<DuplicateCheck>("/repair/chain-check", {
    params: { material_id: materialId, plant },
  })
}

export function getRepairEconomics(materialId: number, plant?: string): Promise<EconomicEvaluation> {
  return apiFetch<EconomicEvaluation>("/repair/economics", {
    params: { material_id: materialId, plant },
  })
}

export function listAttestations(
  params: { status?: string; origin?: string; plant?: string } = {}
): Promise<Attestation[]> {
  return apiFetch<Attestation[]>("/repair/attestations", { params })
}

export function listPendingDeclarations(plant?: string): Promise<PendingDeclaration[]> {
  return apiFetch<PendingDeclaration[]>("/repair/attestations/pending", { params: { plant } })
}

export function declareAttestation(id: number, note?: string): Promise<Attestation> {
  return apiFetch<Attestation>(`/repair/attestations/${id}/declare`, {
    method: "POST",
    json: { note },
  })
}
