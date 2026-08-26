"""Initiative 8 SS3.2 -- the mandatory condition-to-repair declaration.

This is the one hard gate in the whole initiative. The duplicate alert warns and lets the
user through; the attestation does not:

  * **Manual path.** A requisitioner raising a new-buy requisition for a repairable material
    must declare that the existing item is beyond repair. Without it the requisition cannot
    be created at all -- enforced in `rr_service.create_rr`.

  * **MRP path.** An automatic min/max trigger cannot make a declaration. Those requisitions
    are saved with a PENDING attestation and are BLOCKED at DOA approval until the planner
    or buyer completes it -- enforced in `approval_service.approve`.

Every declaration is written with who declared it, when, and against which requisition, and
mirrored into the audit log. That is what turns an unenforced expectation into evidence.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.services import repair_service
from app.services.audit_service import record_audit
from app.services.csv_store import (
    ATTESTATION_ORIGIN_MANUAL,
    ATTESTATION_ORIGIN_MRP,
    ATTESTATION_STATEMENT,
    ATTESTATION_STATUS_COMPLETE,
    ATTESTATION_STATUS_PENDING,
    DataStore,
    Row,
)


def for_rr(store: DataStore, rr_id: int) -> list[Row]:
    return store.attestations.filter(lambda a: a.get("rr_id") == rr_id)


def pending_for_rr(store: DataStore, rr_id: int) -> list[Row]:
    return [a for a in for_rr(store, rr_id) if a.get("status") == ATTESTATION_STATUS_PENDING]


def rr_has_pending_declaration(store: DataStore, rr_id: int) -> bool:
    return bool(pending_for_rr(store, rr_id))


def record(
    store: DataStore,
    *,
    rr_id: int,
    material_id: int,
    plant: str,
    origin: str,
    declared_by: int | None,
    status: str = ATTESTATION_STATUS_COMPLETE,
    chain_snapshot: dict | None = None,
    note: str | None = None,
) -> Row:
    """Write a declaration (or a placeholder pending one, for the MRP path)."""
    now = datetime.now(timezone.utc)
    complete = status == ATTESTATION_STATUS_COMPLETE

    statement = ATTESTATION_STATEMENT if complete else None
    if complete and note:
        statement = f"{ATTESTATION_STATEMENT} {note.strip()}"

    row = store.attestations.insert(
        {
            "id": store.attestations.next_id(),
            "rr_id": rr_id,
            "material_id": material_id,
            "plant": plant,
            "origin": origin,
            "status": status,
            "statement": statement,
            "declared_by": declared_by if complete else None,
            "declared_at": now.isoformat() if complete else None,
            "chain_snapshot": chain_snapshot,
            "created_at": now.isoformat(),
        }
    )

    if complete:
        record_audit(
            store,
            user_id=declared_by,
            action="ATTESTATION_DECLARED",
            entity_type="RR",
            entity_id=rr_id,
            new_value={"material_id": material_id, "origin": origin, "statement": statement},
        )
    else:
        record_audit(
            store,
            user_id=None,
            action="ATTESTATION_PENDING",
            entity_type="RR",
            entity_id=rr_id,
            new_value={"material_id": material_id, "origin": origin, "reason": "MRP-raised; planner declaration required"},
        )
    return row


def complete_pending(store: DataStore, attestation_id: int, user: Row, note: str | None = None) -> Row:
    """A planner or buyer completes the declaration an MRP-raised requisition is waiting on."""
    attestation = store.attestations.get(attestation_id)
    if attestation is None:
        raise NotFoundError(f"Attestation {attestation_id} not found")
    if attestation.get("status") == ATTESTATION_STATUS_COMPLETE:
        raise ConflictError(f"Attestation {attestation_id} has already been declared")

    now = datetime.now(timezone.utc)
    statement = ATTESTATION_STATEMENT
    if note:
        statement = f"{ATTESTATION_STATEMENT} {note.strip()}"

    updated = store.attestations.update(
        attestation_id,
        status=ATTESTATION_STATUS_COMPLETE,
        statement=statement,
        declared_by=user["id"],
        declared_at=now.isoformat(),
    )

    record_audit(
        store,
        user_id=user["id"],
        action="ATTESTATION_DECLARED",
        entity_type="RR",
        entity_id=updated.get("rr_id"),
        new_value={"attestation_id": attestation_id, "origin": updated.get("origin"), "statement": statement},
    )
    return updated


def declare_for_rr(store: DataStore, rr_id: int, user: Row, note: str | None = None) -> list[Row]:
    """Complete every declaration a requisition is still waiting on."""
    pending = pending_for_rr(store, rr_id)
    if not pending:
        raise ValidationAppError(f"RR {rr_id} has no pending condition-to-repair declaration")
    return [complete_pending(store, row["id"], user, note) for row in pending]


def repairable_lines_in_payload(store: DataStore, line_items) -> list:
    """Which lines on an incoming requisition reference a repairable material."""
    return [line for line in line_items if repair_service.material_is_repairable(store, line.material_id)]


def build_pending_queue(store: DataStore, plant: str | None = None) -> list[dict]:
    """Requisitions blocked at DOA waiting on a planner's declaration -- the MRP work queue."""
    rr_by_id = {r["id"]: r for r in store.rr.all()}
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    users_by_id = {u["id"]: u for u in store.users.all()}

    queue: list[dict] = []
    for row in store.attestations.all():
        if row.get("status") != ATTESTATION_STATUS_PENDING:
            continue
        rr = rr_by_id.get(row.get("rr_id"))
        if rr is None:
            continue
        if plant and rr.get("plant") != plant:
            continue
        material = materials_by_id.get(row.get("material_id"))
        requester = users_by_id.get(rr.get("requester_id"))
        queue.append(
            {
                "attestation_id": row["id"],
                "rr_id": rr["id"],
                "rr_number": rr.get("rr_number"),
                "rr_status": rr.get("status"),
                "plant": rr.get("plant"),
                "department": rr.get("department"),
                "priority": rr.get("priority"),
                "trigger_type": rr.get("trigger_type"),
                "origin": row.get("origin"),
                "material_id": row.get("material_id"),
                "material_code": material.get("material_code") if material else None,
                "material_description": material.get("description") if material else None,
                "requester": requester.get("name") if requester else None,
                "created_at": row.get("created_at"),
                "duplicate_flag": bool(rr.get("duplicate_flag")),
                "chain_snapshot": row.get("chain_snapshot"),
            }
        )

    queue.sort(key=lambda q: q.get("created_at") or "")
    return queue


def build_log(
    store: DataStore, status: str | None = None, origin: str | None = None, plant: str | None = None
) -> list[dict]:
    """The full declaration log -- who declared what, when, and against which requisition."""
    rr_by_id = {r["id"]: r for r in store.rr.all()}
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    users_by_id = {u["id"]: u for u in store.users.all()}

    out: list[dict] = []
    for row in store.attestations.all():
        if status and row.get("status") != status:
            continue
        if origin and row.get("origin") != origin:
            continue
        if plant and row.get("plant") != plant:
            continue
        rr = rr_by_id.get(row.get("rr_id"))
        material = materials_by_id.get(row.get("material_id"))
        declarer = users_by_id.get(row.get("declared_by"))
        out.append(
            {
                "id": row["id"],
                "rr_id": row.get("rr_id"),
                "rr_number": rr.get("rr_number") if rr else None,
                "rr_status": rr.get("status") if rr else None,
                "material_id": row.get("material_id"),
                "material_code": material.get("material_code") if material else None,
                "material_description": material.get("description") if material else None,
                "plant": row.get("plant"),
                "origin": row.get("origin"),
                "status": row.get("status"),
                "statement": row.get("statement"),
                "declared_by": row.get("declared_by"),
                "declared_by_name": declarer.get("name") if declarer else None,
                "declared_at": row.get("declared_at"),
                "created_at": row.get("created_at"),
                "duplicate_flag": bool(rr.get("duplicate_flag")) if rr else False,
                "chain_snapshot": row.get("chain_snapshot"),
            }
        )

    out.sort(key=lambda a: a.get("created_at") or "", reverse=True)
    return out


__all__ = [
    "ATTESTATION_ORIGIN_MANUAL",
    "ATTESTATION_ORIGIN_MRP",
    "build_log",
    "build_pending_queue",
    "complete_pending",
    "declare_for_rr",
    "for_rr",
    "pending_for_rr",
    "record",
    "rr_has_pending_declaration",
]
