from datetime import date, datetime, timezone

from app.core.exceptions import ValidationAppError
from app.schemas.procurement import RequestRequisitionCreate
from app.services.audit_service import record_audit
from app.services.csv_store import DataStore, Row, area_for_department


def create_rr(store: DataStore, requester: Row, payload: RequestRequisitionCreate, source_system: str = "manual") -> Row:
    """Validate and persist a real (non-synthetic) RR. This is the only path that writes
    RR rows on behalf of a user or the AI assistant -- the assistant calls this exact
    function via the create_rr tool, never touching the store directly."""

    if not payload.line_items:
        raise ValidationAppError("At least one line item is required")

    materials: dict[int, Row] = {}
    for line in payload.line_items:
        if line.quantity <= 0:
            raise ValidationAppError(f"Quantity must be greater than 0 for material {line.material_id}")
        material = store.materials.get(line.material_id)
        if material is None or not material.get("active"):
            raise ValidationAppError(f"Material {line.material_id} does not exist or is inactive")
        materials[line.material_id] = material

    now = datetime.now(timezone.utc)
    total_value = sum(
        float(line.quantity) * float(materials[line.material_id].get("last_po_price") or 0) for line in payload.line_items
    )

    rr_id = store.rr.next_id()
    rr = store.rr.insert(
        {
            "id": rr_id,
            "rr_number": f"RR-{1000 + rr_id}",
            "requester_id": requester["id"],
            "plant": payload.plant,
            "department": payload.department,
            "area": area_for_department(payload.department),
            "trigger_type": "OAR_MANUAL",  # a human/chat request, never an automatic min-max trigger
            "creation_date": date.today().isoformat(),
            "required_date": payload.required_date.isoformat(),
            "purpose": payload.purpose,
            "status": "WAITING_DOA",
            "priority": payload.priority,
            "total_estimated_value": round(total_value, 2),
            "source_system": source_system,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    )

    for i, line in enumerate(payload.line_items, start=1):
        material = materials[line.material_id]
        store.rr_line_items.insert(
            {
                "id": store.rr_line_items.next_id(),
                "rr_id": rr_id,
                "line_number": i,
                "material_id": material["id"],
                "quantity": line.quantity,
                "estimated_unit_price": float(material.get("last_po_price") or 0),
                "service_code": line.service_code or material.get("service_code"),
                "description": line.description or material.get("description"),
                "quality_status": "OK",
            }
        )

    store.process_stage_events.insert(
        {
            "id": store.process_stage_events.next_id(),
            "entity_type": "RR",
            "entity_id": rr_id,
            "stage_code": "RR_CREATED",
            "stage_name": "RR Created",
            "started_at": now.isoformat(),
            "completed_at": now.isoformat(),
            "status": "COMPLETED",
            "owner_id": requester["id"],
            "source_system": source_system,
        }
    )
    store.process_stage_events.insert(
        {
            "id": store.process_stage_events.next_id(),
            "entity_type": "RR",
            "entity_id": rr_id,
            "stage_code": "DOA",
            "stage_name": "DOA Approval",
            "started_at": now.isoformat(),
            "completed_at": None,
            "status": "IN_PROGRESS",
            "owner_id": None,
            "source_system": source_system,
        }
    )
    approver_role = "COMMERCIAL_MANAGER" if payload.priority == "Critical" else "ENGINEERING_MANAGER"
    store.approvals.insert(
        {
            "id": store.approvals.next_id(),
            "approval_type": "DOA",
            "entity_type": "RR",
            "rr_id": rr_id,
            "pr_id": None,
            "po_id": None,
            "approval_level": 1,
            "approver_id": None,
            "approver_role": approver_role,
            "status": "PENDING",
            "match_tier": None,
            "urgency": payload.priority,
            "related_chat_session_id": None,
            "submitted_at": now.isoformat(),
            "action_at": None,
            "comments": None,
        }
    )

    record_audit(store, user_id=requester["id"], action="RR_CREATED", entity_type="RR", entity_id=rr_id, new_value={"rr_number": rr["rr_number"], "source": source_system})

    return rr
