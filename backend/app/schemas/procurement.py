from datetime import date, datetime

from pydantic import Field

from app.schemas.common import ORMBase


class RRLineItemOut(ORMBase):
    id: int
    line_number: int
    material_id: int
    quantity: float
    estimated_unit_price: float
    service_code: str | None
    description: str
    quality_status: str


class RequestRequisitionOut(ORMBase):
    id: int
    rr_number: str
    requester_id: int
    plant: str
    department: str
    creation_date: date
    required_date: date
    purpose: str
    status: str
    priority: str
    total_estimated_value: float
    source_system: str
    created_at: datetime
    updated_at: datetime
    line_items: list[RRLineItemOut] = Field(default_factory=list)


class RRLineItemCreate(ORMBase):
    material_id: int
    quantity: float
    description: str | None = None
    service_code: str | None = None


class RequestRequisitionCreate(ORMBase):
    plant: str
    department: str
    required_date: date
    purpose: str
    priority: str = "Normal"
    line_items: list[RRLineItemCreate]


class PRLineItemOut(ORMBase):
    id: int
    material_id: int
    quantity: float
    unit_price: float
    service_code: str | None
    description: str
    line_status: str
    quality_flags: str | None


class PurchaseRequisitionOut(ORMBase):
    id: int
    pr_number: str
    rr_id: int | None
    creation_date: date
    required_date: date
    status: str
    buyer_id: int | None
    plant: str
    total_value: float
    source_system: str
    line_items: list[PRLineItemOut] = Field(default_factory=list)


class POLineItemOut(ORMBase):
    id: int
    material_id: int
    quantity: float
    unit_price: float
    line_total: float
    delivery_date: date
    status: str


class PurchaseOrderOut(ORMBase):
    id: int
    po_number: str
    pr_id: int
    supplier_id: int
    creation_date: date
    expected_delivery: date
    status: str
    total_value: float
    buyer_id: int | None
    line_items: list[POLineItemOut] = Field(default_factory=list)


class QualityIssueOut(ORMBase):
    line_item_id: int
    material_id: int
    description: str
    issues: list[str]


class PRQualityCheckOut(ORMBase):
    pr_id: int
    pr_number: str
    has_issues: bool
    issues: list[QualityIssueOut]
    explanation: str
