from datetime import date, datetime

from pydantic import Field

from app.schemas.common import ORMBase


class ConsumptionPlanOut(ORMBase):
    id: int
    rr_id: int
    rr_line_id: int
    reservation_number: str
    reservation_type: str
    material_id: int
    plant: str
    department: str
    requester_id: int
    quantity: float
    purpose: str
    job_card_number: str | None
    project: str | None
    equipment: str | None
    criticality: str
    planned_consumption_date: date
    notes: str | None
    created_at: datetime


class ConsumptionPlanCreate(ORMBase):
    plant: str
    department: str
    required_date: date
    priority: str = "Normal"
    material_id: int
    quantity: float
    reservation_type: str  # JOB_CARD | STRAIGHT
    purpose: str
    job_card_number: str | None = None
    project: str | None = None
    equipment: str | None = None
    planned_consumption_date: date
    notes: str | None = None
    stores_qty_override: float | None = None  # demo hook to force a partial-availability split


class UtilizationEventOut(ORMBase):
    id: int
    tracking_id: str
    stage: str
    status: str
    quantity: float | None
    actor_id: int | None
    actor_name: str | None = None
    source: str
    note: str | None
    timestamp: datetime


class RiskAssessmentOut(ORMBase):
    score: int
    level: str
    drivers: list[str]


class StockMatchOut(ORMBase):
    match_type: str  # EXACT | TIER1 | TIER2
    plant: str
    material_id: int
    material_code: str
    description: str
    quantity: float
    unused_stock_id: int | None = None


class StockCheckOut(ORMBase):
    requested_material_id: int
    requested_quantity: float
    matches: list[StockMatchOut]
    estimated_avoided_value: float


class UtilizationRecordOut(ORMBase):
    id: int
    tracking_id: str
    consumption_plan_id: int
    rr_id: int
    rr_number: str | None = None
    rr_line_id: int
    material_id: int
    material_code: str | None = None
    material_description: str | None = None
    plant: str
    department: str
    requester_id: int
    requester_name: str | None = None
    fulfilment_leg: str
    qty_requested: float
    qty_fulfilled: float
    qty_consumed: float
    pr_id: int | None
    pr_number: str | None = None
    po_id: int | None
    po_number: str | None = None
    stage: str
    planned_consumption_date: date
    actual_consumption_date: date | None
    replan_count: int
    previous_planned_date: date | None
    replan_reason: str | None
    release_reason: str | None
    risk_score: int | None
    risk_level: str | None
    risk_drivers: list[str] = Field(default_factory=list)
    historical: bool
    created_at: datetime
    updated_at: datetime
    days_until_planned: int | None = None
    days_past_plan: int | None = None
    aging_severity: str = "Healthy"
    shared_allocation: bool = False


class UtilizationDetailOut(UtilizationRecordOut):
    plan: ConsumptionPlanOut | None = None
    events: list[UtilizationEventOut] = Field(default_factory=list)
    sibling_legs: list[UtilizationRecordOut] = Field(default_factory=list)
    consolidated_with: list[UtilizationRecordOut] = Field(default_factory=list)
    escalation: dict | None = None
    approval: dict | None = None


class ConsumptionPlanResult(ORMBase):
    tracking_id: str
    rr_id: int
    rr_number: str
    records: list[UtilizationRecordOut]
    risk: RiskAssessmentOut
    stock_check: StockCheckOut


class ConfirmConsumedRequest(ORMBase):
    actual_date: date
    comment: str | None = None


class ReplanRequest(ORMBase):
    new_planned_date: date
    reason: str


class ReleaseRequest(ORMBase):
    reason: str = "No longer required"


class ExceptionOut(ORMBase):
    id: int
    tracking_id: str
    type: str
    severity: str
    plant: str
    department: str
    requester_id: int
    requester_name: str | None = None
    status: str
    created_at: datetime
    resolved_at: datetime | None
    note: str | None
    material_description: str | None = None


class RedeploymentRecommendationOut(ORMBase):
    id: int
    requested_tracking_id: str | None
    requested_material_id: int
    requested_material_description: str | None = None
    requested_qty: float
    requested_plant: str
    match_type: str
    unused_stock_id: int | None
    matched_material_id: int
    matched_material_description: str | None = None
    matched_plant: str
    matched_qty: float
    avoided_value: float
    decision: str
    decision_by: int | None
    decision_at: datetime | None
    created_at: datetime


class RedeploymentDecisionRequest(ORMBase):
    decision: str  # USE_EXISTING | TRANSFER | PURCHASE


class UnusedStockOut(ORMBase):
    id: int
    material_id: int
    material_code: str | None = None
    material_description: str | None = None
    plant: str
    quantity: float
    source: str
    source_tracking_id: str | None
    status: str
    created_at: datetime


class UnmatchedIssueOut(ORMBase):
    id: int
    material_id: int
    material_description: str | None = None
    plant: str
    quantity: float
    issue_date: date
    suggested_tracking_id: str | None
    confidence: int | None
    signals: list[str] = Field(default_factory=list)
    status: str
    resolved_at: datetime | None


class UnmatchedIssueResolveRequest(ORMBase):
    action: str  # CONFIRM | REJECT
