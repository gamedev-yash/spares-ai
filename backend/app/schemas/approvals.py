from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMBase


class ApprovalOut(ORMBase):
    id: int
    approval_type: str
    entity_type: str
    rr_id: int | None
    pr_id: int | None
    po_id: int | None
    approval_level: int
    approver_id: int | None
    approver_role: str
    status: str
    match_tier: str | None
    urgency: str | None
    submitted_at: datetime
    action_at: datetime | None
    comments: str | None
    # Joined convenience fields for the Approvals UI -- populated by the route, not the ORM.
    rr_number: str | None = None
    requester_name: str | None = None
    material_description: str | None = None
    total_value: float | None = None
    # Initiative 8: the duplicate context and the requisitioner's condition-to-repair
    # declaration travel with the document, so the approver sees both at decision time.
    duplicate_flag: bool = False
    duplicate_context: dict | None = None
    attestation: dict | None = None
    # True when the requisition was auto-raised and is still awaiting a planner's
    # declaration -- approval is blocked until it is completed.
    attestation_pending: bool = False


class ApprovalActionRequest(BaseModel):
    comments: str | None = None
