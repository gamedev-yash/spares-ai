"""Approve/reject/escalate state machine for an Approval row. No RBAC in this build (see
PROMPT_SPEC.md Part 10) -- any user can act on any approval; `approver_role` is kept as
descriptive metadata (who *should* act) rather than an enforced gate.
"""

from datetime import datetime, timezone

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.services import attestation_service
from app.services.audit_service import record_audit
from app.services.csv_store import DataStore, Row
from app.services.notification_service import notify


def _get_approval(store: DataStore, approval_id: int) -> Row:
    approval = store.approvals.get(approval_id)
    if approval is None:
        raise NotFoundError(f"Approval {approval_id} not found")
    return approval


def _close_open_stage_event(store: DataStore, entity_type: str, entity_id: int, stage_code: str, status: str, now: datetime) -> None:
    candidates = [
        e for e in store.process_stage_events.all()
        if e["entity_type"] == entity_type and e["entity_id"] == entity_id and e["stage_code"] == stage_code and e["status"] == "IN_PROGRESS"
    ]
    if not candidates:
        return
    candidates.sort(key=lambda e: e["started_at"], reverse=True)
    store.process_stage_events.update(candidates[0]["id"], completed_at=now.isoformat(), status=status)


def approve(store: DataStore, approval_id: int, user: Row, comments: str | None) -> Row:
    approval = _get_approval(store, approval_id)
    if approval["status"] != "PENDING":
        raise ConflictError(f"Approval {approval_id} is already {approval['status']}")

    # --- Initiative 8: the MRP-path declaration gate --------------------------------
    # MRP cannot attest, so an auto-raised requisition for a repairable material is saved
    # with a PENDING declaration. It cannot progress until a planner or buyer completes it
    # (Initiative 8 SS3.2). This is the only other hard block in the initiative.
    rr_id = approval.get("rr_id")
    if rr_id is not None and attestation_service.rr_has_pending_declaration(store, rr_id):
        pending = attestation_service.pending_for_rr(store, rr_id)
        rr_row = store.rr.get(rr_id)
        raise ValidationAppError(
            f"{rr_row['rr_number'] if rr_row else f'RR {rr_id}'} was raised automatically for a "
            "repairable material and is still awaiting its condition-to-repair declaration. "
            "A planner or buyer must complete the declaration before this approval can proceed.",
            details={
                "code": "attestation_pending",
                "rr_id": rr_id,
                "attestation_ids": [a["id"] for a in pending],
            },
        )

    now = datetime.now(timezone.utc)
    approval = store.approvals.update(approval_id, status="APPROVED", action_at=now.isoformat(), comments=comments)

    rr = store.rr.get(approval["rr_id"]) if approval.get("rr_id") else None
    if approval["approval_type"] == "DOA" and rr is not None:
        _close_open_stage_event(store, "RR", rr["id"], "DOA", "COMPLETED", now)
        rr = store.rr.update(rr["id"], status="MRP_PROCESSING")

    record_audit(store, user_id=user["id"], action="APPROVAL_APPROVED", entity_type="APPROVAL", entity_id=approval["id"], new_value={"status": "APPROVED"})
    if rr is not None:
        notify(
            store,
            recipient_id=rr["requester_id"],
            ntype="APPROVAL_RESULT",
            title=f"{rr['rr_number']} approved",
            message=f"Your requisition was approved at {approval['approval_type']} stage.",
            related_entity_type="RR",
            related_entity_id=rr["id"],
        )
    return approval


def reject(store: DataStore, approval_id: int, user: Row, comments: str | None) -> Row:
    approval = _get_approval(store, approval_id)
    if approval["status"] != "PENDING":
        raise ConflictError(f"Approval {approval_id} is already {approval['status']}")

    now = datetime.now(timezone.utc)
    approval = store.approvals.update(approval_id, status="REJECTED", action_at=now.isoformat(), comments=comments)

    rr = store.rr.get(approval["rr_id"]) if approval.get("rr_id") else None
    if approval["approval_type"] == "DOA" and rr is not None:
        _close_open_stage_event(store, "RR", rr["id"], "DOA", "REJECTED", now)
        rr = store.rr.update(rr["id"], status="REJECTED")

    record_audit(store, user_id=user["id"], action="APPROVAL_REJECTED", entity_type="APPROVAL", entity_id=approval["id"], new_value={"status": "REJECTED"})
    if rr is not None:
        notify(
            store,
            recipient_id=rr["requester_id"],
            ntype="APPROVAL_RESULT",
            title=f"{rr['rr_number']} rejected",
            message=f"Your requisition was rejected at {approval['approval_type']} stage.",
            related_entity_type="RR",
            related_entity_id=rr["id"],
        )
    return approval


def escalate(store: DataStore, approval_id: int, user: Row, comments: str | None) -> Row:
    approval = _get_approval(store, approval_id)
    if approval["status"] != "PENDING":
        raise ConflictError(f"Approval {approval_id} is already {approval['status']}")

    now = datetime.now(timezone.utc)
    approval = store.approvals.update(
        approval_id, status="ESCALATED", approval_level=approval["approval_level"] + 1, action_at=now.isoformat(), comments=comments
    )

    rr = store.rr.get(approval["rr_id"]) if approval.get("rr_id") else None
    if rr is not None:
        rr = store.rr.update(rr["id"], status="ESCALATED")

    record_audit(store, user_id=user["id"], action="APPROVAL_ESCALATED", entity_type="APPROVAL", entity_id=approval["id"], new_value={"status": "ESCALATED", "approval_level": approval["approval_level"]})
    if rr is not None:
        notify(
            store,
            recipient_id=rr["requester_id"],
            ntype="APPROVAL_RESULT",
            title=f"{rr['rr_number']} escalated",
            message=f"Your requisition's {approval['approval_type']} approval was escalated for further review.",
            related_entity_type="RR",
            related_entity_id=rr["id"],
        )
    return approval
