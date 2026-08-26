"""Initiative 8 response/request shapes -- repair register, duplicate guard, attestations."""

from app.schemas.common import ORMBase


class RepairChainOut(ORMBase):
    material_id: int
    material_code: str | None = None
    material_description: str | None = None
    material_group: str | None = None
    plant: str | None = None
    repair_pr_number: str | None = None
    repair_pr_id: int | None = None
    repair_po_number: str | None = None
    repair_po_id: int | None = None
    supplier_id: int | None = None
    vendor: str | None = None
    quantity_under_repair: float
    repair_value: float
    opened_at: str | None = None
    expected_return: str | None = None
    days_open: int | None = None
    days_overdue: int = 0
    overdue: bool = False
    stage: str | None = None


class RegisterRowOut(RepairChainOut):
    stock_on_hand: int
    unit_of_measure: str | None = None
    reorder_point: int | None = None
    reorder_triggered: bool = False
    criticality: str | None = None
    new_unit_cost: float = 0.0
    new_lead_time_days: int = 0
    declarations_pending: int = 0
    declarations_complete: int = 0
    duplicate_risk: bool = False


class RegisterSummaryOut(ORMBase):
    open_chain_count: int
    total_quantity_under_repair: float
    total_value_under_repair: float
    overdue_count: int
    reorder_triggered_count: int
    duplicate_risk_count: int
    pending_declaration_count: int
    average_days_open: float | None = None


class RegisterOut(ORMBase):
    items: list[RegisterRowOut]
    summary: RegisterSummaryOut
    total: int


class DuplicateCheckOut(ORMBase):
    material_id: int
    material_code: str | None = None
    material_description: str | None = None
    plant: str | None = None
    is_repairable: bool
    has_active_chain: bool
    total_quantity_under_repair: float = 0.0
    earliest_expected_return: str | None = None
    chains: list[RepairChainOut] = []
    # Present only when a chain is active -- there is no decision to inform otherwise.
    economics: "EconomicEvaluationOut | None" = None
    attestation_required: bool = False
    attestation_statement: str | None = None


class EconomicEvaluationOut(ORMBase):
    material_id: int
    material_code: str | None = None
    material_description: str | None = None
    plant: str | None = None
    quantity: float
    repair_total_cost: float
    repair_cost_basis: str
    repair_reference: str | None = None
    repair_vendor: str | None = None
    repair_expected_return: str | None = None
    repair_days_until_return: int | None = None
    repair_is_overdue: bool = False
    new_total_cost: float
    new_unit_cost: float
    new_lead_time_days: int
    saving_if_repair_used: float
    saving_pct: float | None = None
    repair_arrives_sooner: bool = False


DuplicateCheckOut.model_rebuild()


class AttestationOut(ORMBase):
    id: int
    rr_id: int | None = None
    rr_number: str | None = None
    rr_status: str | None = None
    material_id: int | None = None
    material_code: str | None = None
    material_description: str | None = None
    plant: str | None = None
    origin: str | None = None
    status: str | None = None
    statement: str | None = None
    declared_by: int | None = None
    declared_by_name: str | None = None
    declared_at: str | None = None
    created_at: str | None = None
    duplicate_flag: bool = False
    chain_snapshot: dict | None = None


class PendingDeclarationOut(ORMBase):
    attestation_id: int
    rr_id: int
    rr_number: str | None = None
    rr_status: str | None = None
    plant: str | None = None
    department: str | None = None
    priority: str | None = None
    trigger_type: str | None = None
    origin: str | None = None
    material_id: int | None = None
    material_code: str | None = None
    material_description: str | None = None
    requester: str | None = None
    created_at: str | None = None
    duplicate_flag: bool = False
    chain_snapshot: dict | None = None


class DeclareRequest(ORMBase):
    note: str | None = None
