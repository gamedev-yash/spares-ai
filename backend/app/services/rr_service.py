from datetime import date, datetime, timezone

from app.core.exceptions import ValidationAppError
from app.schemas.procurement import RequestRequisitionCreate
from app.services import attestation_service, repair_service
from app.services.audit_service import record_audit
from app.services.csv_store import (
    ATTESTATION_ORIGIN_CHAT,
    ATTESTATION_ORIGIN_MANUAL,
    DataStore,
    Row,
    area_for_department,
    is_repairable_code,
)


def create_rr(store: DataStore, requester: Row, payload: RequestRequisitionCreate, source_system: str = "manual") -> Row:
    """Validate and persist a real (non-synthetic) RR. This is the only path that writes
    RR rows on behalf of a user or the AI assistant -- the assistant calls this exact
    function via the create_rr tool, never touching the store directly.

    Initiative 8 adds two controls here, and puts them in this one function deliberately:
    because both the REST route and the chat assistant funnel through it, the guard and the
    declaration apply identically on both paths and neither can bypass the other.

      * the condition-to-repair declaration is a HARD GATE for repairable materials;
      * the active-repair-chain check is ADVISORY -- it flags the requisition and carries
        the context forward to the approver, but never refuses the request.
    """

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

    # --- Initiative 8: mandatory condition-to-repair declaration (hard gate) ---------
    repairable_lines = [
        line for line in payload.line_items
        if is_repairable_code(materials[line.material_id].get("material_code"))
    ]
    if repairable_lines and not payload.attestation_confirmed:
        codes = ", ".join(sorted({materials[line.material_id]["material_code"] for line in repairable_lines}))
        raise ValidationAppError(
            "A condition-to-repair declaration is required before a new requisition can be "
            f"raised for repairable material(s) {codes}. Confirm that the existing item has "
            "been assessed and cannot be repaired.",
            details={
                "code": "attestation_required",
                "material_ids": [line.material_id for line in repairable_lines],
                "material_codes": sorted({materials[line.material_id]["material_code"] for line in repairable_lines}),
                "statement_required": True,
            },
        )

    # --- Initiative 8: active repair chain detection (advisory) ----------------------
    duplicate_context: dict | None = None
    if repairable_lines:
        detected = [
            result
            for result in (
                repair_service.check_duplicate(store, line.material_id, payload.plant)
                for line in repairable_lines
            )
            if result["has_active_chain"]
        ]
        if detected:
            duplicate_context = {
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "plant": payload.plant,
                "materials": detected,
                "chain_count": sum(len(d["chains"]) for d in detected),
            }

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
            "duplicate_flag": duplicate_context is not None,
            "duplicate_context": duplicate_context,
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

    # --- Initiative 8: record the declaration against the requisition ----------------
    # It travels with the document through the release strategy and appears in the approver
    # alert, so the approver sees the chain context and the requisitioner's declaration at
    # the same moment (Initiative 8 SS3.2).
    if repairable_lines:
        origin = ATTESTATION_ORIGIN_CHAT if source_system == "chat_assistant" else ATTESTATION_ORIGIN_MANUAL
        for line in repairable_lines:
            attestation_service.record(
                store,
                rr_id=rr_id,
                material_id=line.material_id,
                plant=payload.plant,
                origin=origin,
                declared_by=requester["id"],
                chain_snapshot=duplicate_context,
                note=payload.attestation_note,
            )

    if duplicate_context is not None:
        record_audit(
            store,
            user_id=requester["id"],
            action="DUPLICATE_CHAIN_FLAGGED",
            entity_type="RR",
            entity_id=rr_id,
            new_value={"rr_number": rr["rr_number"], "chain_count": duplicate_context["chain_count"]},
        )

    return rr
