"""Initiative 13 -- Spares Utilization Tracking business logic.

Everything here is deterministic mock logic over the CSV store, following the same
principle already established for PR quality checks (app/services/quality_validation.py):
business-critical calculations are plain code, not "AI reasoning". Nothing here talks to
SAP -- it only ever *recommends*; a human always executes the actual stock/SAP action
(see the `Recommend...`/`Confirm...` verbs used throughout the API surface).
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from typing import Any

from app.core.exceptions import NotFoundError, ValidationAppError
from app.schemas.procurement import RequestRequisitionCreate, RRLineItemCreate
from app.schemas.utilization import ConsumptionPlanCreate
from app.services.audit_service import record_audit
from app.services.csv_store import DataStore, Row, area_for_department
from app.services.notification_service import notify
from app.services import rr_service

TERMINAL_STAGES = {"CONSUMED", "RELEASED", "TRANSFERRED", "CLOSED"}
OAR_MATERIAL_GROUPS = {"Mechanical Seals", "Instrumentation", "Pumps", "Bearings", "Valves", "Electrical Spares"}
GRACE_DAYS_BY_LEAD = 14  # extra buffer added on top of a material's lead time before we call a plan "unrealistic"


# ---------------------------------------------------------------------------
# OAR classification -- deterministic (hash of material_code + criticality/group
# weighting), since the underlying materials.csv has no such column. Stable across
# calls for the same material.
# ---------------------------------------------------------------------------

def classify_material(material: Row) -> tuple[str, str]:
    code = str(material.get("material_code") or material.get("id"))
    bucket = int(hashlib.sha1(code.encode()).hexdigest(), 16) % 100
    weight = 0
    if material.get("material_group") in OAR_MATERIAL_GROUPS:
        weight += 35
    if material.get("criticality") in ("CRITICAL", "HIGH"):
        weight += 20
    if float(material.get("stock_level") or 0) <= 5:
        weight += 15
    is_oar = bucket < weight
    if is_oar:
        return "OAR", f"{material.get('material_group')} spares of this criticality are typically ordered as required, not stocked."
    return "Stocked", "This material is normally carried as regular stock."


# ---------------------------------------------------------------------------
# NM/SM risk scoring
# ---------------------------------------------------------------------------

def assess_risk(store: DataStore, material: Row, plant: str, department: str, quantity: float, requester_id: int) -> dict:
    drivers: list[str] = []
    score = 20

    material_id = material["id"]
    past_lines = [
        l for l in store.rr_line_items.all()
        if l.get("material_id") == material_id
    ]
    consumption_events = len(past_lines)
    if consumption_events <= 1:
        score += 25
        drivers.append("Only 1 prior requisition for this material in the dataset")
    elif consumption_events <= 3:
        score += 10
        drivers.append(f"Only {consumption_events} prior requisitions for this material")

    avg_qty = (sum(float(l.get("quantity") or 0) for l in past_lines) / consumption_events) if consumption_events else quantity
    if avg_qty > 0 and quantity >= avg_qty * 2.5:
        score += 20
        drivers.append(f"Requested quantity is {quantity / avg_qty:.1f}x the historical average order size")

    dept_rrs = [r for r in store.rr.all() if r.get("department") == department]
    dept_released = 0
    dept_lines = {l["rr_id"]: l for l in store.rr_line_items.all()}
    for t in store.utilization_tracking.all():
        if t.get("department") == department and t.get("stage") == "RELEASED":
            dept_released += 1
    if dept_released >= 2:
        score += 15
        drivers.append(f"{department} has {dept_released} previously released/unused OAR lines")

    if material.get("criticality") == "CRITICAL" and consumption_events <= 2:
        score += 10
        drivers.append("Critical-criticality material with thin consumption history")

    same_group_unused = [
        u for u in store.unused_stock.all()
        if u.get("status") == "AVAILABLE" and (store.materials.get(u.get("material_id")) or {}).get("material_group") == material.get("material_group")
    ]
    if same_group_unused:
        score += 10
        drivers.append(f"Similar material already sitting unused ({len(same_group_unused)} lines in this material group)")

    score = max(5, min(97, score))
    level = "LOW" if score < 40 else "MEDIUM" if score < 65 else "HIGH"
    if not drivers:
        drivers.append("No elevated risk signals found for this material/department combination")
    return {"score": score, "level": level, "drivers": drivers[:5]}


# ---------------------------------------------------------------------------
# Pre-order intelligence: exact + Tier1/Tier2 alternate stock, cross-plant.
# ---------------------------------------------------------------------------

def _alternate_materials(store: DataStore, material: Row, limit: int = 2) -> list[Row]:
    candidates = sorted(
        (
            m for m in store.materials.all()
            if m.get("active") and m["id"] != material["id"] and m.get("material_group") == material.get("material_group")
        ),
        key=lambda m: m["id"],
    )
    return candidates[:limit]

def stock_check(store: DataStore, material: Row, plant: str, quantity: float) -> dict:
    matches: list[dict] = []
    avoided = 0.0
    price = float(material.get("last_po_price") or 0)

    exact_pool = [u for u in store.unused_stock.all() if u.get("status") == "AVAILABLE" and u.get("material_id") == material["id"]]
    for u in sorted(exact_pool, key=lambda u: (u.get("plant") != plant, -float(u.get("quantity") or 0))):
        qty = float(u.get("quantity") or 0)
        matches.append({
            "match_type": "EXACT", "plant": u["plant"], "material_id": material["id"],
            "material_code": material["material_code"], "description": material["description"],
            "quantity": qty, "unused_stock_id": u["id"],
        })
        avoided += min(qty, quantity) * price

    for alt in _alternate_materials(store, material):
        alt_pool = [u for u in store.unused_stock.all() if u.get("status") == "AVAILABLE" and u.get("material_id") == alt["id"]]
        if not alt_pool:
            continue
        tier = "TIER1" if alt["id"] == _alternate_materials(store, material)[0]["id"] else "TIER2"
        for u in sorted(alt_pool, key=lambda u: (u.get("plant") != plant, -float(u.get("quantity") or 0)))[:1]:
            qty = float(u.get("quantity") or 0)
            matches.append({
                "match_type": tier, "plant": u["plant"], "material_id": alt["id"],
                "material_code": alt["material_code"], "description": alt["description"],
                "quantity": qty, "unused_stock_id": u["id"],
            })
            avoided += min(qty, quantity) * float(alt.get("last_po_price") or price)

    return {
        "requested_material_id": material["id"],
        "requested_quantity": quantity,
        "matches": matches,
        "estimated_avoided_value": round(avoided, 2),
    }


# ---------------------------------------------------------------------------
# Aging
# ---------------------------------------------------------------------------

def compute_aging(stage: str, planned_date: date, today: date) -> tuple[int | None, int | None, str]:
    if stage in TERMINAL_STAGES:
        return None, None, "Healthy"
    delta = (planned_date - today).days
    if delta > 7:
        return delta, None, "Healthy"
    if delta > 0:
        return delta, None, "Due Soon"
    if delta == 0:
        return 0, 0, "Due Today"
    days_past = -delta
    if days_past <= 30:
        return None, days_past, "Overdue"
    return None, days_past, "Critical"


def _next_tracking_id(store: DataStore, consumption_plan_id: int) -> str:
    return f"UTL-{date.today().year}-{1000 + consumption_plan_id}"


def _log_event(store: DataStore, tracking_id: str, stage: str, status: str, quantity: float | None, actor_id: int | None, source: str, note: str | None) -> Row:
    return store.utilization_events.insert({
        "id": store.utilization_events.next_id(),
        "tracking_id": tracking_id,
        "stage": stage,
        "status": status,
        "quantity": quantity,
        "actor_id": actor_id,
        "source": source,
        "note": note,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------------------
# Consumption-plan creation -- the OAR extension of rr_service.create_rr.
# ---------------------------------------------------------------------------

def create_consumption_plan(store: DataStore, requester: Row, payload: ConsumptionPlanCreate, source_system: str = "manual") -> dict:
    material = store.materials.get(payload.material_id)
    if material is None or not material.get("active"):
        raise ValidationAppError(f"Material {payload.material_id} does not exist or is inactive")
    if payload.quantity <= 0:
        raise ValidationAppError("Quantity must be greater than 0")
    if payload.reservation_type not in ("JOB_CARD", "STRAIGHT"):
        raise ValidationAppError("reservation_type must be JOB_CARD or STRAIGHT")
    if payload.reservation_type == "JOB_CARD" and not payload.job_card_number:
        raise ValidationAppError("job_card_number is required for a job-card-linked reservation")
    if payload.reservation_type == "STRAIGHT" and not (payload.project or payload.equipment):
        raise ValidationAppError("A straight reservation needs a project, equipment, or operational purpose")
    if len((payload.purpose or "").strip()) < 8:
        raise ValidationAppError("Purpose is too vague -- describe the job/shutdown/activity this material is for")

    rr_payload = RequestRequisitionCreate(
        plant=payload.plant,
        department=payload.department,
        required_date=payload.required_date,
        purpose=payload.purpose,
        priority=payload.priority,
        line_items=[RRLineItemCreate(material_id=payload.material_id, quantity=payload.quantity)],
    )
    rr = rr_service.create_rr(store, requester, rr_payload, source_system=source_system)
    rr_line = next(l for l in store.rr_line_items.filter(lambda l: l["rr_id"] == rr["id"]))

    now = datetime.now(timezone.utc)
    plan_id = store.consumption_plans.next_id()
    plan = store.consumption_plans.insert({
        "id": plan_id,
        "rr_id": rr["id"],
        "rr_line_id": rr_line["id"],
        "reservation_number": str(70010000 + plan_id),
        "reservation_type": payload.reservation_type,
        "material_id": payload.material_id,
        "plant": payload.plant,
        "department": payload.department,
        "requester_id": requester["id"],
        "quantity": payload.quantity,
        "purpose": payload.purpose,
        "job_card_number": payload.job_card_number,
        "project": payload.project,
        "equipment": payload.equipment,
        "criticality": material.get("criticality") or "MEDIUM",
        "planned_consumption_date": payload.planned_consumption_date.isoformat(),
        "notes": payload.notes,
        "created_at": now.isoformat(),
    })

    tracking_id = _next_tracking_id(store, plan_id)
    risk = assess_risk(store, material, payload.plant, payload.department, payload.quantity, requester["id"])
    check = stock_check(store, material, payload.plant, payload.quantity)

    stores_qty = payload.stores_qty_override if payload.stores_qty_override is not None else 0.0
    stores_qty = max(0.0, min(stores_qty, payload.quantity))
    procurement_qty = payload.quantity - stores_qty

    records: list[Row] = []

    def _insert_leg(leg: str, qty: float, stage: str) -> Row:
        tid = store.utilization_tracking.next_id()
        rec = store.utilization_tracking.insert({
            "id": tid,
            "tracking_id": tracking_id,
            "consumption_plan_id": plan_id,
            "rr_id": rr["id"],
            "rr_line_id": rr_line["id"],
            "material_id": payload.material_id,
            "plant": payload.plant,
            "department": payload.department,
            "requester_id": requester["id"],
            "fulfilment_leg": leg,
            "qty_requested": qty,
            "qty_fulfilled": qty if stage == "AVAILABLE_IN_STORES" else 0,
            "qty_consumed": 0,
            "pr_id": None,
            "po_id": None,
            "stage": stage,
            "planned_consumption_date": payload.planned_consumption_date.isoformat(),
            "actual_consumption_date": None,
            "replan_count": 0,
            "previous_planned_date": None,
            "replan_reason": None,
            "release_reason": None,
            "risk_score": risk["score"],
            "risk_level": risk["level"],
            "risk_drivers": risk["drivers"],
            "historical": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        })
        _log_event(store, tracking_id, "PLAN_CREATED", "COMPLETED", qty, requester["id"], source_system, f"Consumption plan captured ({leg.lower()} leg).")
        records.append(rec)
        return rec

    if stores_qty > 0:
        _insert_leg("STORES", stores_qty, "AVAILABLE_IN_STORES")
    if procurement_qty > 0:
        _insert_leg("PROCUREMENT", procurement_qty, "PENDING_APPROVAL")

    _log_event(store, tracking_id, "DUPLICATE_CHECK", "COMPLETED", None, requester["id"], source_system,
               f"Duplicate-demand check completed -- {len(check['matches'])} potential match(es), est. avoided value R{check['estimated_avoided_value']:,.2f}." if check["matches"] else "Duplicate-demand check completed -- no existing unused stock found.")

    record_audit(store, user_id=requester["id"], action="CONSUMPTION_PLAN_CREATED", entity_type="UTILIZATION", entity_id=plan_id,
                 new_value={"tracking_id": tracking_id, "rr_number": rr["rr_number"], "risk_level": risk["level"]})

    return {
        "tracking_id": tracking_id,
        "rr_id": rr["id"],
        "rr_number": rr["rr_number"],
        "records": [hydrate_record(store, r) for r in records],
        "risk": risk,
        "stock_check": check,
    }


# ---------------------------------------------------------------------------
# Hydration
# ---------------------------------------------------------------------------

def _material(store: DataStore, material_id: int) -> Row | None:
    return store.materials.get(material_id)


def hydrate_record(store: DataStore, t: Row, today: date | None = None) -> dict:
    today = today or date.today()
    material = _material(store, t.get("material_id"))
    rr = store.rr.get(t.get("rr_id"))
    user = store.users.get(t.get("requester_id"))
    pr = store.pr.get(t.get("pr_id")) if t.get("pr_id") else None
    po = store.po.get(t.get("po_id")) if t.get("po_id") else None
    planned = date.fromisoformat(t["planned_consumption_date"])
    days_until, days_past, severity = compute_aging(t["stage"], planned, today)

    shared_allocation = False
    if t.get("pr_id"):
        siblings = [r for r in store.utilization_tracking.all() if r.get("pr_id") == t.get("pr_id") and r["id"] != t["id"]]
        shared_allocation = len(siblings) > 0

    return {
        "id": t["id"],
        "tracking_id": t["tracking_id"],
        "consumption_plan_id": t["consumption_plan_id"],
        "rr_id": t["rr_id"],
        "rr_number": rr["rr_number"] if rr else None,
        "rr_line_id": t["rr_line_id"],
        "material_id": t["material_id"],
        "material_code": material["material_code"] if material else None,
        "material_description": material["description"] if material else None,
        "plant": t["plant"],
        "department": t["department"],
        "requester_id": t["requester_id"],
        "requester_name": user["name"] if user else None,
        "fulfilment_leg": t["fulfilment_leg"],
        "qty_requested": t["qty_requested"],
        "qty_fulfilled": t["qty_fulfilled"],
        "qty_consumed": t["qty_consumed"],
        "pr_id": t.get("pr_id"),
        "pr_number": pr["pr_number"] if pr else None,
        "po_id": t.get("po_id"),
        "po_number": po["po_number"] if po else None,
        "stage": t["stage"],
        "planned_consumption_date": t["planned_consumption_date"],
        "actual_consumption_date": t.get("actual_consumption_date"),
        "replan_count": t.get("replan_count") or 0,
        "previous_planned_date": t.get("previous_planned_date"),
        "replan_reason": t.get("replan_reason"),
        "release_reason": t.get("release_reason"),
        "risk_score": t.get("risk_score"),
        "risk_level": t.get("risk_level"),
        "risk_drivers": t.get("risk_drivers") or [],
        "historical": bool(t.get("historical")),
        "created_at": t["created_at"],
        "updated_at": t["updated_at"],
        "days_until_planned": days_until,
        "days_past_plan": days_past,
        "aging_severity": severity,
        "shared_allocation": shared_allocation,
    }


def list_utilization(store: DataStore, *, plant: str | None = None, department: str | None = None,
                      requester_id: int | None = None, stage: str | None = None, risk_level: str | None = None,
                      aging_severity: str | None = None, mine_only_user: Row | None = None,
                      page: int = 1, page_size: int = 25) -> dict:
    rows = [hydrate_record(store, t) for t in store.utilization_tracking.all()]
    if plant:
        rows = [r for r in rows if r["plant"] == plant]
    if department:
        rows = [r for r in rows if r["department"] == department]
    if requester_id:
        rows = [r for r in rows if r["requester_id"] == requester_id]
    if stage:
        rows = [r for r in rows if r["stage"] == stage]
    if risk_level:
        rows = [r for r in rows if r["risk_level"] == risk_level]
    if aging_severity:
        rows = [r for r in rows if r["aging_severity"] == aging_severity]
    if mine_only_user:
        rows = [r for r in rows if r["requester_id"] == mine_only_user["id"]]

    rows.sort(key=lambda r: r["created_at"], reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    return {"items": rows[start:start + page_size], "total": total, "page": page, "page_size": page_size}


def get_utilization_detail(store: DataStore, record_id: int) -> dict:
    t = store.utilization_tracking.get(record_id)
    if t is None:
        raise NotFoundError(f"Utilization record {record_id} not found")
    record = hydrate_record(store, t)
    plan = store.consumption_plans.get(t["consumption_plan_id"])
    events = sorted(store.utilization_events.filter(lambda e: e["tracking_id"] == t["tracking_id"]), key=lambda e: e["timestamp"])
    for e in events:
        actor = store.users.get(e.get("actor_id")) if e.get("actor_id") else None
        e["actor_name"] = actor["name"] if actor else None
    siblings = [hydrate_record(store, r) for r in store.utilization_tracking.all() if r["tracking_id"] == t["tracking_id"] and r["id"] != t["id"]]
    consolidated = []
    if t.get("pr_id"):
        consolidated = [hydrate_record(store, r) for r in store.utilization_tracking.all() if r.get("pr_id") == t.get("pr_id") and r["id"] != t["id"]]
    escalation_rows = sorted(store.escalations.filter(lambda e: e["tracking_id"] == t["tracking_id"]), key=lambda e: e["id"])
    escalation = None
    if escalation_rows:
        latest = escalation_rows[-1]
        owner = store.users.get(latest.get("owner_id"))
        escalation = {**latest, "owner_name": owner["name"] if owner else None, "chain": escalation_rows}

    approval = None
    doa = next(iter(store.approvals.filter(lambda a: a["rr_id"] == t["rr_id"] and a["approval_type"] == "DOA")), None)
    if doa is not None:
        approver = store.users.get(doa.get("approver_id")) if doa.get("approver_id") else None
        approval = {
            "level": doa["approval_level"], "role": doa["approver_role"], "status": doa["status"],
            "approver_name": approver["name"] if approver else None, "action_at": doa.get("action_at"),
        }

    return {
        **record, "plan": plan, "events": events, "sibling_legs": siblings, "consolidated_with": consolidated,
        "escalation": escalation, "approval": approval,
    }


def _resolve_exceptions_for(store: DataStore, tracking_id: str, resolver_id: int | None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for e in store.utilization_exceptions.filter(lambda e: e["tracking_id"] == tracking_id and e["status"] == "OPEN"):
        store.utilization_exceptions.update(e["id"], status="RESOLVED", resolved_at=now, resolved_by=resolver_id)


def confirm_consumed(store: DataStore, actor: Row, record_id: int, actual_date: date, comment: str | None) -> dict:
    t = store.utilization_tracking.get(record_id)
    if t is None:
        raise NotFoundError(f"Utilization record {record_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    store.utilization_tracking.update(record_id, stage="CONSUMED", qty_consumed=t["qty_fulfilled"], actual_consumption_date=actual_date.isoformat(), updated_at=now)
    _log_event(store, t["tracking_id"], "CONSUMED", "COMPLETED", t["qty_fulfilled"], actor["id"], "manual", comment or "Requester confirmed consumption.")
    _resolve_exceptions_for(store, t["tracking_id"], actor["id"])
    record_audit(store, user_id=actor["id"], action="UTILIZATION_CONFIRMED_CONSUMED", entity_type="UTILIZATION", entity_id=record_id, new_value={"actual_date": actual_date.isoformat()})
    return get_utilization_detail(store, record_id)


def replan(store: DataStore, actor: Row, record_id: int, new_planned_date: date, reason: str) -> dict:
    t = store.utilization_tracking.get(record_id)
    if t is None:
        raise NotFoundError(f"Utilization record {record_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    old_date = t["planned_consumption_date"]
    store.utilization_tracking.update(
        record_id,
        previous_planned_date=old_date,
        planned_consumption_date=new_planned_date.isoformat(),
        replan_count=(t.get("replan_count") or 0) + 1,
        replan_reason=reason,
        updated_at=now,
    )
    _log_event(store, t["tracking_id"], "REPLANNED", "COMPLETED", None, actor["id"], "manual", f"Re-planned from {old_date} to {new_planned_date.isoformat()}.")
    _log_event(store, t["tracking_id"], "REPLAN_REASON", "COMPLETED", None, actor["id"], "manual", f"Reason: {reason}")
    _resolve_exceptions_for(store, t["tracking_id"], actor["id"])
    record_audit(store, user_id=actor["id"], action="UTILIZATION_REPLANNED", entity_type="UTILIZATION", entity_id=record_id,
                 old_value={"planned_consumption_date": old_date}, new_value={"planned_consumption_date": new_planned_date.isoformat(), "reason": reason})
    return get_utilization_detail(store, record_id)


def release(store: DataStore, actor: Row, record_id: int, reason: str) -> dict:
    t = store.utilization_tracking.get(record_id)
    if t is None:
        raise NotFoundError(f"Utilization record {record_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    remaining_qty = float(t["qty_fulfilled"]) if float(t["qty_fulfilled"]) > 0 else float(t["qty_requested"])
    store.utilization_tracking.update(record_id, stage="RELEASED", release_reason=reason, updated_at=now)
    _log_event(store, t["tracking_id"], "RELEASED", "COMPLETED", remaining_qty, actor["id"], "manual", f"Reason: {reason}. Released for redeployment -- awaiting SAP action by inventory personnel.")
    store.unused_stock.insert({
        "id": store.unused_stock.next_id(),
        "material_id": t["material_id"],
        "plant": t["plant"],
        "quantity": remaining_qty,
        "source": "RELEASED",
        "source_tracking_id": t["tracking_id"],
        "status": "AVAILABLE",
        "created_at": now,
        "updated_at": now,
    })
    _resolve_exceptions_for(store, t["tracking_id"], actor["id"])
    record_audit(store, user_id=actor["id"], action="UTILIZATION_RELEASED", entity_type="UTILIZATION", entity_id=record_id, new_value={"reason": reason, "quantity": remaining_qty})
    notify(store, recipient_id=t["requester_id"], ntype="UTILIZATION_RELEASED", title=f"{t['tracking_id']} released",
           message="Release recorded in Spares AI. Authorized inventory personnel must complete the applicable SAP stock action.",
           related_entity_type="UTILIZATION", related_entity_id=record_id)
    return get_utilization_detail(store, record_id)


# ---------------------------------------------------------------------------
# Exceptions (derived overdue/unconfirmed items + persisted operational exceptions)
# ---------------------------------------------------------------------------

DERIVED_EXCEPTION_TYPES = {"CONSUMPTION_OVERDUE", "ISSUED_UNCONFIRMED"}


def _hydrate_exception(store: DataStore, e: Row) -> dict:
    user = store.users.get(e.get("requester_id"))
    material_desc = None
    tracking = next((t for t in store.utilization_tracking.all() if t["tracking_id"] == e["tracking_id"]), None)
    if tracking:
        m = store.materials.get(tracking["material_id"])
        material_desc = m["description"] if m else None
    return {**e, "requester_name": user["name"] if user else None, "material_description": material_desc}


def list_exceptions(store: DataStore, *, plant: str | None = None, department: str | None = None,
                     requester_id: int | None = None, exc_type: str | None = None, severity: str | None = None,
                     status: str | None = "OPEN", page: int = 1, page_size: int = 50) -> dict:
    today = date.today()
    seen_keys: set[tuple[str, str]] = set()
    combined: list[dict] = []

    for e in store.utilization_exceptions.all():
        combined.append(dict(e))
        seen_keys.add((e["tracking_id"], e["type"]))

    for t in store.utilization_tracking.all():
        if t["stage"] in TERMINAL_STAGES or t["stage"] in ("AVAILABLE_IN_STORES", "PENDING_APPROVAL", "APPROVED", "ON_PR", "ON_PO", "IN_TRANSIT"):
            continue
        planned = date.fromisoformat(t["planned_consumption_date"])
        _, days_past, severity_bucket = compute_aging(t["stage"], planned, today)
        if severity_bucket not in ("Overdue", "Critical"):
            continue
        exc_type_derived = "ISSUED_UNCONFIRMED" if t["stage"] in ("ISSUED", "AWAITING_CONFIRMATION") else "CONSUMPTION_OVERDUE"
        key = (t["tracking_id"], exc_type_derived)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        combined.append({
            "id": -t["id"],
            "tracking_id": t["tracking_id"],
            "type": exc_type_derived,
            "severity": "CRITICAL" if severity_bucket == "Critical" else "HIGH",
            "plant": t["plant"],
            "department": t["department"],
            "requester_id": t["requester_id"],
            "status": "OPEN",
            "created_at": t["updated_at"],
            "resolved_at": None,
            "resolved_by": None,
            "note": f"{days_past} day(s) past the planned consumption date." if days_past else "Issued but not yet confirmed as consumed.",
        })

    hydrated = [_hydrate_exception(store, e) for e in combined]
    if plant:
        hydrated = [e for e in hydrated if e["plant"] == plant]
    if department:
        hydrated = [e for e in hydrated if e["department"] == department]
    if requester_id:
        hydrated = [e for e in hydrated if e["requester_id"] == requester_id]
    if exc_type:
        hydrated = [e for e in hydrated if e["type"] == exc_type]
    if severity:
        hydrated = [e for e in hydrated if e["severity"] == severity]
    if status:
        hydrated = [e for e in hydrated if e["status"] == status]

    hydrated.sort(key=lambda e: e["created_at"], reverse=True)
    total = len(hydrated)
    start = (page - 1) * page_size
    return {"items": hydrated[start:start + page_size], "total": total, "page": page, "page_size": page_size}


def resolve_exception(store: DataStore, actor: Row, exception_id: int, note: str | None) -> dict:
    if exception_id < 0:
        raise ValidationAppError("This exception is derived live from aging and clears automatically once the record is actioned (confirm/re-plan/release) -- open the linked utilization record instead.")
    e = store.utilization_exceptions.get(exception_id)
    if e is None:
        raise NotFoundError(f"Exception {exception_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    updated = store.utilization_exceptions.update(exception_id, status="RESOLVED", resolved_at=now, resolved_by=actor["id"], note=note or e.get("note"))
    record_audit(store, user_id=actor["id"], action="EXCEPTION_RESOLVED", entity_type="UTILIZATION_EXCEPTION", entity_id=exception_id, new_value={"note": note})
    return _hydrate_exception(store, updated)


# ---------------------------------------------------------------------------
# Redeployment
# ---------------------------------------------------------------------------

def _hydrate_recommendation(store: DataStore, r: Row) -> dict:
    req_m = store.materials.get(r.get("requested_material_id"))
    match_m = store.materials.get(r.get("matched_material_id"))
    return {
        **r,
        "requested_material_description": req_m["description"] if req_m else None,
        "matched_material_description": match_m["description"] if match_m else None,
    }


def list_redeployment_recommendations(store: DataStore, *, decision: str | None = None, plant: str | None = None) -> list[dict]:
    rows = store.redeployment_recommendations.all()
    if decision:
        rows = [r for r in rows if r["decision"] == decision]
    if plant:
        rows = [r for r in rows if r["requested_plant"] == plant]
    rows = sorted(rows, key=lambda r: r["created_at"], reverse=True)
    return [_hydrate_recommendation(store, r) for r in rows]


def list_unused_stock(store: DataStore, *, plant: str | None = None, status: str | None = "AVAILABLE") -> list[dict]:
    rows = store.unused_stock.all()
    if plant:
        rows = [r for r in rows if r["plant"] == plant]
    if status:
        rows = [r for r in rows if r["status"] == status]
    out = []
    for r in rows:
        m = store.materials.get(r["material_id"])
        out.append({**r, "material_code": m["material_code"] if m else None, "material_description": m["description"] if m else None})
    return sorted(out, key=lambda r: r["created_at"], reverse=True)


def decide_redeployment(store: DataStore, actor: Row, recommendation_id: int, decision: str) -> dict:
    if decision not in ("USE_EXISTING", "TRANSFER", "PURCHASE"):
        raise ValidationAppError("decision must be USE_EXISTING, TRANSFER, or PURCHASE")
    rec = store.redeployment_recommendations.get(recommendation_id)
    if rec is None:
        raise NotFoundError(f"Redeployment recommendation {recommendation_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    updated = store.redeployment_recommendations.update(recommendation_id, decision=decision, decision_by=actor["id"], decision_at=now)

    if decision in ("USE_EXISTING", "TRANSFER") and rec.get("unused_stock_id"):
        store.unused_stock.update(rec["unused_stock_id"], status="TRANSFERRED" if decision == "TRANSFER" else "CONSUMED", updated_at=now)
        if rec.get("requested_tracking_id"):
            target = next((t for t in store.utilization_tracking.all() if t["tracking_id"] == rec["requested_tracking_id"]), None)
            if target:
                store.utilization_tracking.update(target["id"], stage="TRANSFERRED" if decision == "TRANSFER" else "AVAILABLE_IN_STORES", updated_at=now)
                _log_event(store, rec["requested_tracking_id"], "REDEPLOYMENT_ACCEPTED", "COMPLETED", rec.get("matched_qty"), actor["id"], "manual",
                           f"{decision.replace('_', ' ').title()} recommendation accepted -- purchase avoided (est. R{float(rec.get('avoided_value') or 0):,.2f}).")

    record_audit(store, user_id=actor["id"], action="REDEPLOYMENT_DECISION", entity_type="REDEPLOYMENT_RECOMMENDATION", entity_id=recommendation_id, new_value={"decision": decision})
    return _hydrate_recommendation(store, updated)


# ---------------------------------------------------------------------------
# Unmatched (manual/emergency) issue reconciliation
# ---------------------------------------------------------------------------

def list_unmatched_issues(store: DataStore, *, status: str | None = "PENDING") -> list[dict]:
    rows = store.unmatched_issues.all()
    if status:
        rows = [r for r in rows if r["status"] == status]
    out = []
    for r in rows:
        m = store.materials.get(r["material_id"])
        out.append({**r, "material_description": m["description"] if m else None})
    return sorted(out, key=lambda r: r["issue_date"], reverse=True)


AGE_BUCKET_LABELS = ["Not Due", "1-7 days", "8-30 days", "31-60 days", "61-90 days", "90+ days"]


def _age_bucket(days_past: int | None) -> str:
    if days_past is None:
        return "Not Due"
    if days_past <= 7:
        return "1-7 days"
    if days_past <= 30:
        return "8-30 days"
    if days_past <= 60:
        return "31-60 days"
    if days_past <= 90:
        return "61-90 days"
    return "90+ days"


def get_dashboard(store: DataStore) -> dict:
    today = date.today()
    active_records = []
    for t in store.utilization_tracking.all():
        m = store.materials.get(t["material_id"])
        planned = date.fromisoformat(t["planned_consumption_date"])
        days_until, days_past, severity = compute_aging(t["stage"], planned, today)
        price = float(m.get("last_po_price") or 0) if m else 0.0
        outstanding_qty = max(0.0, float(t["qty_requested"]) - float(t["qty_consumed"]))
        value = outstanding_qty * price
        active_records.append({**t, "material": m, "days_past": days_past, "severity": severity, "value": value})

    non_terminal = [r for r in active_records if r["stage"] not in TERMINAL_STAGES]

    # --- Dashboard 1: Unutilized OAR position ---
    unutilized_value = sum(r["value"] for r in non_terminal)
    unutilized_lines = len(non_terminal)
    overdue_value = sum(r["value"] for r in non_terminal if r["days_past"] is not None)
    exceptions = list_exceptions(store, status="OPEN", page=1, page_size=1000)["items"]
    critical_exceptions = sum(1 for e in exceptions if e["severity"] == "CRITICAL")
    released_stock = list_unused_stock(store, status="AVAILABLE")
    released_value = sum(float(r["quantity"]) * float((store.materials.get(r["material_id"]) or {}).get("last_po_price") or 0) for r in released_stock)

    by_age: dict[str, float] = {b: 0.0 for b in AGE_BUCKET_LABELS}
    for r in non_terminal:
        by_age[_age_bucket(r["days_past"])] += r["value"]

    by_department: dict[str, float] = {}
    by_plant: dict[str, float] = {}
    by_material: dict[str, float] = {}
    for r in non_terminal:
        by_department[r["department"]] = by_department.get(r["department"], 0) + r["value"]
        by_plant[r["plant"]] = by_plant.get(r["plant"], 0) + r["value"]
        if r["material"]:
            key = r["material"]["description"]
            by_material[key] = by_material.get(key, 0) + r["value"]

    top_materials = sorted(by_material.items(), key=lambda kv: kv[1], reverse=True)[:8]

    # --- Dashboard 2: Plan compliance ---
    total_plans = len(active_records) or 1
    complete_plans_pct = round(100 * sum(1 for r in active_records if not r["historical"]) / total_plans, 1)
    consumed = [r for r in active_records if r["stage"] == "CONSUMED"]
    on_time = [r for r in consumed if r.get("actual_consumption_date") and r["actual_consumption_date"] <= r["planned_consumption_date"]]
    on_time_pct = round(100 * len(on_time) / len(consumed), 1) if consumed else 100.0
    replanned = [r for r in active_records if (r.get("replan_count") or 0) > 0]
    replan_rate_pct = round(100 * len(replanned) / total_plans, 1)
    fulfilled = [r for r in active_records if float(r["qty_fulfilled"]) > 0]
    confirmation_compliance_pct = round(100 * len(consumed) / len(fulfilled), 1) if fulfilled else 100.0
    overdue_now = [r for r in non_terminal if r["days_past"]]
    avg_days_past_plan = round(sum(r["days_past"] for r in overdue_now) / len(overdue_now), 1) if overdue_now else 0.0

    dept_compliance = []
    for dept, rows in _group_by(active_records, "department").items():
        total = len(rows) or 1
        ok = sum(1 for r in rows if r["stage"] == "CONSUMED" or r["days_past"] is None)
        dept_compliance.append({"department": dept, "compliancePct": round(100 * ok / total, 1)})

    replan_reasons: dict[str, int] = {}
    for r in replanned:
        reason = r.get("replan_reason") or "Other"
        replan_reasons[reason] = replan_reasons.get(reason, 0) + 1

    requester_ranking = []
    for req_id, rows in _group_by(active_records, "requester_id").items():
        user = store.users.get(req_id)
        overdue_count = sum(1 for r in rows if r["days_past"])
        if overdue_count == 0:
            continue
        requester_ranking.append({"requester": user["name"] if user else f"User {req_id}", "overdueCount": overdue_count})
    requester_ranking.sort(key=lambda r: r["overdueCount"], reverse=True)

    trend: dict[str, dict[str, int]] = {}
    for r in active_records:
        month = r["planned_consumption_date"][:7]
        trend.setdefault(month, {"planned": 0, "actual": 0})
        trend[month]["planned"] += 1
        if r.get("actual_consumption_date"):
            trend.setdefault(r["actual_consumption_date"][:7], {"planned": 0, "actual": 0})
            trend[r["actual_consumption_date"][:7]]["actual"] += 1

    # --- Dashboard 3: NM/SM inflow ---
    newly_aged = [r for r in non_terminal if r["severity"] in ("Overdue", "Critical")]
    newly_aged_value = sum(r["value"] for r in newly_aged)
    high_risk_value = sum(r["value"] for r in non_terminal if r.get("risk_level") == "HIGH")
    recs = store.redeployment_recommendations.all()
    avoided_value = sum(float(r.get("avoided_value") or 0) for r in recs if r["decision"] in ("USE_EXISTING", "TRANSFER"))

    inflow_by_month: dict[str, float] = {}
    for r in newly_aged:
        month = r["planned_consumption_date"][:7]
        inflow_by_month[month] = inflow_by_month.get(month, 0) + r["value"]

    # --- Dashboard 4: Redeployment & avoidance ---
    transfers_recommended = sum(1 for r in recs if r["requested_plant"] != r["matched_plant"])
    transfers_accepted = sum(1 for r in recs if r["decision"] == "TRANSFER")
    exact_matches = sum(1 for r in recs if r["match_type"] == "EXACT")
    alt_matches = sum(1 for r in recs if r["match_type"] in ("TIER1", "TIER2"))

    # --- Dashboard 5: Reclassification candidates ---
    consumption_counts: dict[int, list[dict]] = {}
    for r in active_records:
        if r["stage"] != "CONSUMED" or not r["material"]:
            continue
        consumption_counts.setdefault(r["material_id"], []).append(r)
    reclass_candidates = []
    for material_id, rows in consumption_counts.items():
        if len(rows) < 4:
            continue
        m = rows[0]["material"]
        total_qty = sum(float(r["qty_consumed"]) for r in rows)
        confidence = min(97, 55 + len(rows) * 6)
        reclass_candidates.append({
            "material_id": material_id, "material_code": m["material_code"], "description": m["description"],
            "plant": rows[0]["plant"], "annual_consumption_events": len(rows), "annual_quantity": total_qty,
            "current_oar_status": "OAR", "suggested_action": "Recommend for planning review", "confidence": confidence,
        })
    reclass_candidates.sort(key=lambda r: r["annual_consumption_events"], reverse=True)

    insights: list[str] = []
    if dept_compliance:
        worst_dept = min(dept_compliance, key=lambda d: d["compliancePct"])
        if worst_dept["compliancePct"] < 80:
            insights.append(f"{worst_dept['department']} has the lowest plan compliance at {worst_dept['compliancePct']:.0f}%.")
    if requester_ranking:
        top = requester_ranking[0]
        insights.append(f"Requester {top['requester']} has {top['overdueCount']} overdue consumption confirmation(s).")
    if by_department:
        top_dept = max(by_department.items(), key=lambda kv: kv[1])
        share = 100 * top_dept[1] / unutilized_value if unutilized_value else 0
        insights.append(f"{top_dept[0]} accounts for {share:.0f}% of unutilized OAR value.")
    repeat_replan_depts = {d: sum(1 for r in rows if (r.get("replan_count") or 0) >= 2) for d, rows in _group_by(active_records, "department").items()}
    for dept, count in repeat_replan_depts.items():
        if count >= 2:
            insights.append(f"{dept} has {count} OAR request(s) re-planned more than once.")
            break

    return {
        "unutilizedPosition": {
            "kpis": {
                "unutilizedOarValue": round(unutilized_value, 2),
                "unutilizedOarLines": unutilized_lines,
                "overdueValue": round(overdue_value, 2),
                "criticalExceptions": critical_exceptions,
                "releasedForRedeployment": round(released_value, 2),
            },
            "byAgeBucket": [{"bucket": b, "value": round(by_age[b], 2)} for b in AGE_BUCKET_LABELS],
            "byDepartment": [{"department": k, "value": round(v, 2)} for k, v in sorted(by_department.items(), key=lambda kv: kv[1], reverse=True)],
            "byPlant": [{"plant": k, "value": round(v, 2)} for k, v in sorted(by_plant.items(), key=lambda kv: kv[1], reverse=True)],
            "topMaterials": [{"material": k, "value": round(v, 2)} for k, v in top_materials],
        },
        "planCompliance": {
            "kpis": {
                "completePlansPct": complete_plans_pct,
                "onTimeConsumptionPct": on_time_pct,
                "replanRatePct": replan_rate_pct,
                "confirmationCompliancePct": confirmation_compliance_pct,
                "avgDaysPastPlan": avg_days_past_plan,
            },
            "byDepartment": sorted(dept_compliance, key=lambda d: d["compliancePct"]),
            "trend": [{"month": m, **v} for m, v in sorted(trend.items())],
            "replanReasons": [{"reason": k, "count": v} for k, v in sorted(replan_reasons.items(), key=lambda kv: kv[1], reverse=True)],
            "requesterRanking": requester_ranking[:8],
        },
        "nmSmInflow": {
            "kpis": {
                "newlyAgedValue": round(newly_aged_value, 2),
                "riskValue": round(high_risk_value, 2),
                "avoidedValue": round(avoided_value, 2),
            },
            "monthlyInflow": [{"month": m, "value": round(v, 2)} for m, v in sorted(inflow_by_month.items())],
        },
        "redeployment": {
            "kpis": {
                "purchaseAvoidanceValue": round(avoided_value, 2),
                "transfersRecommended": transfers_recommended,
                "transfersAccepted": transfers_accepted,
                "releasedStockValue": round(released_value, 2),
                "exactMatches": exact_matches,
                "approvedAlternateMatches": alt_matches,
            },
            "recommendations": [_hydrate_recommendation(store, r) for r in sorted(recs, key=lambda r: r["created_at"], reverse=True)],
        },
        "reclassification": {"candidates": reclass_candidates},
        "insights": insights[:5],
    }


def _group_by(rows: list[dict], key: str) -> dict[Any, list[dict]]:
    out: dict[Any, list[dict]] = {}
    for r in rows:
        out.setdefault(r[key], []).append(r)
    return out


def resolve_unmatched_issue(store: DataStore, actor: Row, issue_id: int, action: str) -> dict:
    if action not in ("CONFIRM", "REJECT"):
        raise ValidationAppError("action must be CONFIRM or REJECT")
    issue = store.unmatched_issues.get(issue_id)
    if issue is None:
        raise NotFoundError(f"Unmatched issue {issue_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    status = "CONFIRMED" if action == "CONFIRM" else "REJECTED"
    updated = store.unmatched_issues.update(issue_id, status=status, resolved_at=now)
    if action == "CONFIRM" and issue.get("suggested_tracking_id"):
        _log_event(store, issue["suggested_tracking_id"], "MANUAL_ISSUE_MATCHED", "COMPLETED", issue["quantity"], actor["id"], "manual",
                   f"Unreferenced goods issue ({issue['quantity']:g} units, {issue['plant']}) matched and confirmed by inventory control.")
    record_audit(store, user_id=actor["id"], action="UNMATCHED_ISSUE_RESOLVED", entity_type="UNMATCHED_ISSUE", entity_id=issue_id, new_value={"action": action})
    m = store.materials.get(updated["material_id"])
    return {**updated, "material_description": m["description"] if m else None}
