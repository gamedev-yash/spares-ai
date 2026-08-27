"""Seeds Initiative 13 (Spares Utilization Tracking) demo data on top of the existing
Initiative 9 dataset. Run once against a live backend/data/*.csv set:

    cd backend && .venv/Scripts/python scripts/seed_initiative_13.py

Idempotent guard: if consumption_plans.csv already has rows, the script exits without
writing anything (re-run generate_synthetic_data.py first if you want a clean slate --
that regenerates the Initiative 9 tables this script links against).

Every date below is computed relative to `date.today()` (not hardcoded) so the aging /
overdue / due-soon story is always correct whenever this is run.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.schemas.procurement import RequestRequisitionCreate, RRLineItemCreate
from app.schemas.utilization import ConsumptionPlanCreate
from app.services import rr_service, utilization_service as svc
from app.services.csv_store import DataStore, area_for_department

settings = get_settings()
store = DataStore(settings.data_dir)


def iso(d: date) -> str:
    return d.isoformat()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def pick_material(group: str, criticality: str | None = None, offset: int = 0):
    candidates = [
        m for m in store.materials.all()
        if m.get("active") and m.get("material_group") == group and (criticality is None or m.get("criticality") == criticality)
    ]
    if not candidates:
        candidates = [m for m in store.materials.all() if m.get("active") and m.get("material_group") == group]
    candidates.sort(key=lambda m: m["id"])
    return candidates[offset % len(candidates)]


def pick_users(n: int, role: str = "END_USER", plant: str | None = None):
    pool = [u for u in store.users.all() if u.get("active") and u.get("role") == role and (plant is None or u.get("plant") == plant)]
    if len(pool) < n:
        pool = [u for u in store.users.all() if u.get("active") and u.get("role") == role]
    return [pool[i % len(pool)] for i in range(n)]


def buyer():
    return next(u for u in store.users.all() if u.get("role") == "PROCUREMENT")


def supervisor():
    return next(u for u in store.users.all() if u.get("role") == "WAREHOUSE_SUPERVISOR")


def hod1():
    return next(u for u in store.users.all() if u.get("role") == "ENGINEERING_MANAGER")


def hod2():
    return next(u for u in store.users.all() if u.get("role") == "COMMERCIAL_MANAGER")


def admin():
    return next((u for u in store.users.all() if u.get("role") == "ADMIN"), buyer())


def any_supplier():
    return store.suppliers.all()[0]


def log_event(tracking_id: str, stage: str, status: str, quantity, actor_id, source: str, note: str, ts: str | None = None):
    store.utilization_events.insert({
        "id": store.utilization_events.next_id(), "tracking_id": tracking_id, "stage": stage, "status": status,
        "quantity": quantity, "actor_id": actor_id, "source": source, "note": note, "timestamp": ts or now_iso(),
    })


def approve_doa(rr_id: int, approver_id: int, when: date, final_status: str = "COMPLETED"):
    """Every scenario in this seed script that calls this has already had its full
    procurement history (PR->PO->receipt) written by create_pr_po, so the RR itself is
    finished -- final_status defaults to COMPLETED rather than approval_service's usual
    MRP_PROCESSING (which is for an RR whose PR/PO doesn't exist yet)."""
    approval = next(a for a in store.approvals.filter(lambda a: a["rr_id"] == rr_id and a["approval_type"] == "DOA"))
    store.approvals.update(approval["id"], status="APPROVED", approver_id=approver_id, action_at=iso(when) + "T08:00:00+00:00", comments="Approved (Initiative 13 seed).")
    doa_stage = next(e for e in store.process_stage_events.filter(lambda e: e["entity_type"] == "RR" and e["entity_id"] == rr_id and e["stage_code"] == "DOA"))
    store.process_stage_events.update(doa_stage["id"], status="COMPLETED", completed_at=iso(when) + "T08:00:00+00:00", owner_id=approver_id)
    store.rr.update(rr_id, status=final_status, updated_at=now_iso())


def create_pr_po(rr, material, plant, qty: float, pr_date: date, po_date: date, delivery_date: date, po_status: str, pr_status: str, po_line_status: str):
    b = buyer()
    s = any_supplier()
    price = float(material.get("last_po_price") or 0)
    pr_id = store.pr.next_id()
    store.pr.insert({
        "id": pr_id, "pr_number": f"PR-9{pr_id:04d}", "rr_id": rr["id"], "creation_date": iso(pr_date),
        "required_date": rr["required_date"], "status": pr_status, "buyer_id": b["id"], "plant": plant,
        "total_value": round(qty * price, 2), "source_system": "initiative13_seed",
    })
    store.pr_line_items.insert({
        "id": store.pr_line_items.next_id(), "pr_id": pr_id, "material_id": material["id"], "quantity": qty,
        "unit_price": price, "service_code": material.get("service_code"), "description": material["description"],
        "line_status": "CLOSED" if po_status != "OPEN" else "OPEN", "quality_flags": "",
    })
    po_id = store.po.next_id()
    store.po.insert({
        "id": po_id, "po_number": f"PO-9{po_id:04d}", "pr_id": pr_id, "supplier_id": s["id"], "creation_date": iso(po_date),
        "expected_delivery": iso(delivery_date), "status": po_status, "total_value": round(qty * price, 2), "buyer_id": b["id"],
    })
    store.po_line_items.insert({
        "id": store.po_line_items.next_id(), "po_id": po_id, "material_id": material["id"], "quantity": qty,
        "unit_price": price, "line_total": round(qty * price, 2), "delivery_date": iso(delivery_date), "status": po_line_status,
    })
    return pr_id, po_id


def backdate_rr(rr_id: int, creation_date: date):
    """rr_service.create_rr always stamps creation_date/created_at as `date.today()`.
    Scenarios that replay a multi-week-old procurement history need the RR's own
    timeline pushed back to before its PR/PO/approval dates, so the trace reads
    chronologically. Pushes every row this seed script has already written for
    this RR back to a consistent `creation_date`."""
    ts = iso(creation_date) + "T07:00:00+00:00"
    store.rr.update(rr_id, creation_date=iso(creation_date), created_at=ts, updated_at=ts)
    created_evt = next(iter(store.process_stage_events.filter(lambda e: e["entity_type"] == "RR" and e["entity_id"] == rr_id and e["stage_code"] == "RR_CREATED")), None)
    if created_evt:
        store.process_stage_events.update(created_evt["id"], started_at=ts, completed_at=ts)
    doa_evt = next(iter(store.process_stage_events.filter(lambda e: e["entity_type"] == "RR" and e["entity_id"] == rr_id and e["stage_code"] == "DOA")), None)
    if doa_evt:
        store.process_stage_events.update(doa_evt["id"], started_at=ts)
    doa_appr = next(iter(store.approvals.filter(lambda a: a["rr_id"] == rr_id and a["approval_type"] == "DOA")), None)
    if doa_appr:
        store.approvals.update(doa_appr["id"], submitted_at=ts)
    for ar in store.audit_logs.filter(lambda a: a["entity_type"] == "RR" and a["entity_id"] == rr_id and a["action"] == "RR_CREATED"):
        store.audit_logs.update(ar["id"], timestamp=ts)
    for cp in store.consumption_plans.filter(lambda c: c["rr_id"] == rr_id):
        store.consumption_plans.update(cp["id"], created_at=ts)
        for t in store.utilization_tracking.filter(lambda t: t["consumption_plan_id"] == cp["id"]):
            store.utilization_tracking.update(t["id"], created_at=ts)
            for e in store.utilization_events.filter(lambda e: e["tracking_id"] == t["tracking_id"] and e["stage"] in ("PLAN_CREATED", "DUPLICATE_CHECK")):
                store.utilization_events.update(e["id"], timestamp=ts)


def make_plan(requester, plant, department, material, qty, reservation_type, purpose, planned_date,
              required_date=None, job_card=None, project=None, equipment=None, stores_qty=0.0, priority="Normal"):
    payload = ConsumptionPlanCreate(
        plant=plant, department=department, required_date=required_date or (date.today() + timedelta(days=10)),
        priority=priority, material_id=material["id"], quantity=qty, reservation_type=reservation_type, purpose=purpose,
        job_card_number=job_card, project=project, equipment=equipment, planned_consumption_date=planned_date,
        notes=None, stores_qty_override=stores_qty,
    )
    return svc.create_consumption_plan(store, requester, payload, source_system="synthetic_seed")


def main():
    if store.consumption_plans.all():
        print("consumption_plans.csv already has data -- skipping (idempotent seed).")
        return

    today = date.today()
    requesters = pick_users(6)
    gsb_req = [u for u in requesters if u.get("plant") == "Gamsberg"] or requesters
    bmm_req = [u for u in requesters if u.get("plant") == "BMM"] or requesters
    sup = supervisor()

    seal = pick_material("Mechanical Seals")
    packing = pick_material("Mechanical Seals", offset=1)
    impeller = pick_material("Pumps")
    transmitter = pick_material("Instrumentation")
    bearing = pick_material("Bearings")
    contactor = pick_material("Electrical Spares")

    # --- Scenario A: healthy, on-time, fully consumed ---
    r = gsb_req[0]
    a = make_plan(r, "Gamsberg", r["department"], seal, 2, "JOB_CARD",
                  "Shaft seal replacement during scheduled pump overhaul", today - timedelta(days=5),
                  job_card="JC-44210")
    a_id = a["records"][0]["id"]
    backdate_rr(a["rr_id"], today - timedelta(days=20))
    pr_id, po_id = create_pr_po(store.rr.get(a["rr_id"]), seal, "Gamsberg", 2, today - timedelta(days=18), today - timedelta(days=15), today - timedelta(days=6), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(a["rr_id"], hod1()["id"], today - timedelta(days=19))
    store.utilization_tracking.update(a_id, stage="CONSUMED", qty_fulfilled=2, qty_consumed=2, actual_consumption_date=iso(today - timedelta(days=5)), pr_id=pr_id, po_id=po_id, updated_at=now_iso())
    for stage, note, dt in [
        ("MRP_ALLOCATED", "MRP allocation created.", today - timedelta(days=18)),
        ("PR_GENERATED", f"PR-9{pr_id:04d} generated.", today - timedelta(days=18)),
        ("PO_CREATED", f"PO-9{po_id:04d} created.", today - timedelta(days=15)),
        ("GOODS_RECEIVED", "Goods receipt recorded.", today - timedelta(days=6)),
        ("GOODS_ISSUED", "Goods issue recorded.", today - timedelta(days=6)),
        ("CONSUMED", "Requester confirmed consumption on schedule.", today - timedelta(days=5)),
    ]:
        log_event(a["tracking_id"], stage, "COMPLETED", None, r["id"], "synthetic_seed", note, ts=iso(dt) + "T09:00:00+00:00")

    # --- Scenario B: consumption overdue (issued, unconfirmed) ---
    r = gsb_req[1 % len(gsb_req)]
    b = make_plan(r, "Gamsberg", r["department"], packing, 4, "STRAIGHT",
                  "Gland packing replacement, slurry pump train 2 shutdown", today - timedelta(days=12),
                  equipment="Slurry Pump Train 2")
    b_id = b["records"][0]["id"]
    backdate_rr(b["rr_id"], today - timedelta(days=32))
    pr_id, po_id = create_pr_po(store.rr.get(b["rr_id"]), packing, "Gamsberg", 4, today - timedelta(days=30), today - timedelta(days=27), today - timedelta(days=14), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(b["rr_id"], hod1()["id"], today - timedelta(days=31))
    store.utilization_tracking.update(b_id, stage="ISSUED", qty_fulfilled=4, pr_id=pr_id, po_id=po_id, updated_at=now_iso())
    log_event(b["tracking_id"], "GOODS_RECEIVED", "COMPLETED", 4, r["id"], "synthetic_seed", "Goods receipt recorded.", ts=iso(today - timedelta(days=14)) + "T09:00:00+00:00")
    log_event(b["tracking_id"], "GOODS_ISSUED", "COMPLETED", 4, r["id"], "synthetic_seed", "Goods issue recorded.", ts=iso(today - timedelta(days=13)) + "T09:00:00+00:00")
    log_event(b["tracking_id"], "PLAN_BREACHED", "COMPLETED", None, None, "system", "Planned consumption date breached.", ts=iso(today - timedelta(days=12)) + "T08:00:00+00:00")
    log_event(b["tracking_id"], "REMINDER_SENT", "COMPLETED", None, None, "system", "Requester reminder generated.", ts=iso(today - timedelta(days=12)) + "T08:01:00+00:00")
    store.escalations.insert({"id": store.escalations.next_id(), "tracking_id": b["tracking_id"], "level": "REQUESTER", "owner_id": r["id"], "waiting_since": iso(today - timedelta(days=12)), "reminder_count": 1, "status": "ACTIVE", "escalated_at": None})

    # --- Scenario C: re-plan (shutdown postponed) ---
    r = gsb_req[2 % len(gsb_req)]
    c = make_plan(r, "Gamsberg", r["department"], transmitter, 1, "JOB_CARD",
                  "Pressure transmitter swap during flotation shutdown", today - timedelta(days=3), job_card="JC-44288")
    c_id = c["records"][0]["id"]
    backdate_rr(c["rr_id"], today - timedelta(days=27))
    pr_id, po_id = create_pr_po(store.rr.get(c["rr_id"]), transmitter, "Gamsberg", 1, today - timedelta(days=25), today - timedelta(days=22), today - timedelta(days=9), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(c["rr_id"], hod1()["id"], today - timedelta(days=26))
    old_date = today - timedelta(days=3)
    new_date = today + timedelta(days=20)
    store.utilization_tracking.update(c_id, stage="AWAITING_CONFIRMATION", qty_fulfilled=1, pr_id=pr_id, po_id=po_id,
                                       previous_planned_date=iso(old_date), planned_consumption_date=iso(new_date),
                                       replan_count=1, replan_reason="Shutdown postponed", updated_at=now_iso())
    log_event(c["tracking_id"], "GOODS_ISSUED", "COMPLETED", 1, r["id"], "synthetic_seed", "Goods issue recorded.", ts=iso(today - timedelta(days=9)) + "T09:00:00+00:00")
    log_event(c["tracking_id"], "PLAN_BREACHED", "COMPLETED", None, None, "system", "Planned consumption date breached.", ts=iso(old_date) + "T08:00:00+00:00")
    log_event(c["tracking_id"], "REPLANNED", "COMPLETED", None, r["id"], "manual", f"Re-planned from {old_date.isoformat()} to {new_date.isoformat()}.", ts=iso(today - timedelta(days=1)) + "T11:17:00+00:00")
    log_event(c["tracking_id"], "REPLAN_REASON", "COMPLETED", None, r["id"], "manual", "Reason: shutdown postponed", ts=iso(today - timedelta(days=1)) + "T11:17:00+00:00")

    # --- Scenario D: no longer required -> released for redeployment (Gamsberg) ---
    r = gsb_req[3 % len(gsb_req)]
    d = make_plan(r, "Gamsberg", r["department"], impeller, 1, "STRAIGHT",
                  "Standby impeller for slurry pump P-204 contingency", today - timedelta(days=20),
                  equipment="Slurry Pump P-204")
    d_id = d["records"][0]["id"]
    backdate_rr(d["rr_id"], today - timedelta(days=50))
    pr_id, po_id = create_pr_po(store.rr.get(d["rr_id"]), impeller, "Gamsberg", 1, today - timedelta(days=48), today - timedelta(days=44), today - timedelta(days=25), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(d["rr_id"], hod2()["id"], today - timedelta(days=49))
    store.utilization_tracking.update(d_id, stage="RELEASED", qty_fulfilled=1, pr_id=pr_id, po_id=po_id, release_reason="Contingency no longer required -- P-204 rebuild deferred", updated_at=now_iso())
    log_event(d["tracking_id"], "GOODS_ISSUED", "COMPLETED", 1, r["id"], "synthetic_seed", "Goods issue recorded.", ts=iso(today - timedelta(days=25)) + "T09:00:00+00:00")
    log_event(d["tracking_id"], "RELEASED", "COMPLETED", 1, r["id"], "manual", "Reason: Contingency no longer required -- P-204 rebuild deferred. Released for redeployment.", ts=iso(today - timedelta(days=6)) + "T14:00:00+00:00")
    unused_id = store.unused_stock.next_id()
    store.unused_stock.insert({"id": unused_id, "material_id": impeller["id"], "plant": "Gamsberg", "quantity": 1,
                                "source": "RELEASED", "source_tracking_id": d["tracking_id"], "status": "AVAILABLE",
                                "created_at": now_iso(), "updated_at": now_iso()})
    store.utilization_exceptions.insert({"id": store.utilization_exceptions.next_id(), "tracking_id": d["tracking_id"],
                                          "type": "RELEASED_AWAITING_REDEPLOYMENT", "severity": "MEDIUM", "plant": "Gamsberg",
                                          "department": r["department"], "requester_id": r["id"], "status": "OPEN",
                                          "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
                                          "note": "Released stock awaiting a redeployment or SAP disposition decision."})

    # --- Scenario E: cross-plant purchase avoidance (BMM requests the same impeller, Gamsberg has it released) ---
    r2 = bmm_req[0]
    e = make_plan(r2, "BMM", r2["department"], impeller, 1, "STRAIGHT",
                   "Replacement impeller for BMM slurry pump maintenance", today + timedelta(days=15),
                   equipment="BMM Slurry Pump P-118")
    e_id = e["records"][0]["id"]
    store.redeployment_recommendations.insert({
        "id": store.redeployment_recommendations.next_id(), "requested_tracking_id": e["tracking_id"],
        "requested_material_id": impeller["id"], "requested_qty": 1, "requested_plant": "BMM", "match_type": "EXACT",
        "unused_stock_id": unused_id, "matched_material_id": impeller["id"], "matched_plant": "Gamsberg", "matched_qty": 1,
        "avoided_value": round(float(impeller.get("last_po_price") or 0), 2), "decision": "PENDING", "decision_by": None,
        "decision_at": None, "created_at": now_iso(),
    })
    log_event(e["tracking_id"], "STOCK_MATCH_FOUND", "COMPLETED", 1, None, "system",
              f"Released stock detected at Gamsberg -- recommend inter-plant transfer instead of new purchase (est. avoided value R{float(impeller.get('last_po_price') or 0):,.2f}).")

    # --- Scenario F: approved alternate (Tier1) available, no exact match ---
    r3 = gsb_req[4 % len(gsb_req)]
    f = make_plan(r3, "Gamsberg", r3["department"], bearing, 1, "STRAIGHT",
                   "Bearing replacement for conveyor CV-12 gearbox", today + timedelta(days=10),
                   equipment="Conveyor CV-12 Gearbox")
    f_id = f["records"][0]["id"]
    alt_bearing = pick_material("Bearings", offset=1)
    alt_unused_id = store.unused_stock.next_id()
    store.unused_stock.insert({"id": alt_unused_id, "material_id": alt_bearing["id"], "plant": "Gamsberg", "quantity": 2,
                                "source": "HISTORICAL", "source_tracking_id": None, "status": "AVAILABLE",
                                "created_at": now_iso(), "updated_at": now_iso()})
    store.redeployment_recommendations.insert({
        "id": store.redeployment_recommendations.next_id(), "requested_tracking_id": f["tracking_id"],
        "requested_material_id": bearing["id"], "requested_qty": 1, "requested_plant": "Gamsberg", "match_type": "TIER1",
        "unused_stock_id": alt_unused_id, "matched_material_id": alt_bearing["id"], "matched_plant": "Gamsberg", "matched_qty": 2,
        "avoided_value": round(float(alt_bearing.get("last_po_price") or 0), 2), "decision": "PENDING", "decision_by": None,
        "decision_at": None, "created_at": now_iso(),
    })
    log_event(f["tracking_id"], "STOCK_MATCH_FOUND", "COMPLETED", None, None, "system",
              "No exact stock, but a Tier 1 direct-equivalent bearing is available unused at Gamsberg.")

    # --- Scenario G: partial fulfilment (2 stores + 3 procurement) ---
    r4 = gsb_req[5 % len(gsb_req)]
    g = make_plan(r4, "Gamsberg", r4["department"], contactor, 5, "JOB_CARD",
                   "MCC contactor replacement bank, plant shutdown", today - timedelta(days=2),
                   job_card="JC-44305", stores_qty=2)
    stores_leg = next(rec for rec in g["records"] if rec["fulfilment_leg"] == "STORES")
    proc_leg = next(rec for rec in g["records"] if rec["fulfilment_leg"] == "PROCUREMENT")
    backdate_rr(g["rr_id"], today - timedelta(days=22))
    pr_id, po_id = create_pr_po(store.rr.get(g["rr_id"]), contactor, "Gamsberg", 3, today - timedelta(days=20), today - timedelta(days=17), today - timedelta(days=5), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(g["rr_id"], hod1()["id"], today - timedelta(days=21))
    store.utilization_tracking.update(stores_leg["id"], stage="ISSUED", updated_at=now_iso())
    store.utilization_tracking.update(proc_leg["id"], stage="ISSUED", qty_fulfilled=3, pr_id=pr_id, po_id=po_id, updated_at=now_iso())
    log_event(g["tracking_id"], "STORES_DRAW", "COMPLETED", 2, sup["id"], "synthetic_seed", "2 units issued immediately from stores stock.", ts=iso(today - timedelta(days=2)) + "T10:00:00+00:00")
    log_event(g["tracking_id"], "GOODS_RECEIVED", "COMPLETED", 3, r4["id"], "synthetic_seed", "3 units received against PO (procurement leg).", ts=iso(today - timedelta(days=5)) + "T09:00:00+00:00")
    log_event(g["tracking_id"], "GOODS_ISSUED", "COMPLETED", 3, r4["id"], "synthetic_seed", "3 units issued (procurement leg).", ts=iso(today - timedelta(days=4)) + "T09:00:00+00:00")

    # --- Scenario H: consolidated PR across 3 reservations ---
    h_material = pick_material("Conveyor Components")
    h_reqs = gsb_req[:3]
    h_qtys = [2.0, 3.0, 1.0]
    h_plans = []
    for i, (req, qty) in enumerate(zip(h_reqs, h_qtys)):
        plan = make_plan(req, "Gamsberg", req["department"], h_material, qty, "STRAIGHT",
                          f"Idler set replacement, conveyor CV-{7 + i} routine wear", today - timedelta(days=1),
                          equipment=f"Conveyor CV-{7 + i}", required_date=today + timedelta(days=9))
        h_plans.append(plan)
    consolidated_pr_id, consolidated_po_id = create_pr_po(store.rr.get(h_plans[0]["rr_id"]), h_material, "Gamsberg", sum(h_qtys),
                                                            today - timedelta(days=16), today - timedelta(days=13), today - timedelta(days=1),
                                                            "COMPLETED", "PO_CREATED", "DELIVERED")
    for plan, req, qty in zip(h_plans, h_reqs, h_qtys):
        backdate_rr(plan["rr_id"], today - timedelta(days=18))
        approve_doa(plan["rr_id"], hod1()["id"], today - timedelta(days=17))
        rec_id = plan["records"][0]["id"]
        store.utilization_tracking.update(rec_id, stage="ISSUED", qty_fulfilled=qty, pr_id=consolidated_pr_id, po_id=consolidated_po_id, updated_at=now_iso())
        log_event(plan["tracking_id"], "MRP_CONSOLIDATED", "COMPLETED", qty, None, "system",
                  f"Daily MRP consolidated this reservation into PR-9{consolidated_pr_id:04d} (Qty {sum(h_qtys):g} total, FIFO allocation by requirement date).")
        log_event(plan["tracking_id"], "GOODS_ISSUED", "COMPLETED", qty, req["id"], "synthetic_seed", "Issued against consolidated PO.", ts=iso(today - timedelta(days=1)) + "T09:00:00+00:00")
    store.utilization_exceptions.insert({"id": store.utilization_exceptions.next_id(), "tracking_id": h_plans[1]["tracking_id"],
                                          "type": "CONSOLIDATED_PR_REVIEW", "severity": "LOW", "plant": "Gamsberg",
                                          "department": h_reqs[1]["department"], "requester_id": h_reqs[1]["id"], "status": "OPEN",
                                          "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
                                          "note": f"PR-9{consolidated_pr_id:04d} consolidates 3 reservations -- review FIFO allocation."})

    # --- Scenario I: manual/emergency issue reconciliation ---
    store.unmatched_issues.insert({
        "id": store.unmatched_issues.next_id(), "material_id": seal["id"], "plant": "Gamsberg", "quantity": 2,
        "issue_date": iso(today - timedelta(days=7)), "suggested_tracking_id": b["tracking_id"], "confidence": 87,
        "signals": ["Same material", "Same plant", "Quantity close match", "Date proximity to reservation"],
        "status": "PENDING", "resolved_at": None,
    })

    # --- Scenario J: high NM/SM risk warning on a fresh request ---
    r5 = gsb_req[1 % len(gsb_req)]
    rare_material = pick_material("Milling Components")
    j = make_plan(r5, "Gamsberg", r5["department"], rare_material, 6, "STRAIGHT",
                   "Standby liner set ahead of Q4 mill reline campaign", today + timedelta(days=45),
                   equipment="SAG Mill")
    log_event(j["tracking_id"], "RISK_ASSESSED", "COMPLETED", None, None, "system",
              f"NM/SM risk: {j['risk']['level']} ({j['risk']['score']}%). Drivers: " + "; ".join(j["risk"]["drivers"]))
    if j["risk"]["level"] != "HIGH":
        rec_id = j["records"][0]["id"]
        store.utilization_tracking.update(rec_id, risk_score=82, risk_level="HIGH",
                                           risk_drivers=["Only 1 prior requisition for this material in the dataset",
                                                          "Requested quantity is 3.0x the historical average order size",
                                                          f"{r5['department']} has previously released/unused OAR lines"])
    store.utilization_exceptions.insert({"id": store.utilization_exceptions.next_id(), "tracking_id": j["tracking_id"],
                                          "type": "HIGH_RISK", "severity": "HIGH", "plant": "Gamsberg",
                                          "department": r5["department"], "requester_id": r5["id"], "status": "OPEN",
                                          "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
                                          "note": "High NM/SM risk score at request time -- recommend planning review before approval."})

    # --- Scenario K: reclassification candidate (>4 consumption events/year) ---
    recurring = pick_material("Mechanical Seals", offset=2)
    k_reqs = pick_users(5)
    for i, req in enumerate(k_reqs):
        months_ago = 11 - i * 2
        planned = today - timedelta(days=30 * months_ago)
        k = make_plan(req, req.get("plant") or "Gamsberg", req["department"], recurring, 1, "JOB_CARD",
                       "Routine mechanical seal replacement, scheduled PM", planned, job_card=f"JC-4{4100 + i}",
                       required_date=planned + timedelta(days=14))
        backdate_rr(k["rr_id"], planned - timedelta(days=3))
        rec_id = k["records"][0]["id"]
        store.utilization_tracking.update(rec_id, stage="CONSUMED", qty_fulfilled=1, qty_consumed=1,
                                           actual_consumption_date=iso(planned), updated_at=now_iso())
        log_event(k["tracking_id"], "CONSUMED", "COMPLETED", 1, req["id"], "synthetic_seed", "Routine PM consumption.", ts=iso(planned) + "T09:00:00+00:00")

    # --- Escalation ladder examples (HOD2 + Inventory Control) beyond scenario B's REQUESTER level ---
    r6 = gsb_req[2 % len(gsb_req)]
    esc2 = make_plan(r6, "Gamsberg", r6["department"], transmitter, 1, "STRAIGHT",
                      "Level transmitter swap, tailings thickener", today - timedelta(days=22),
                      equipment="Tailings Thickener TK-3")
    backdate_rr(esc2["rr_id"], today - timedelta(days=42))
    pr_id, po_id = create_pr_po(store.rr.get(esc2["rr_id"]), transmitter, "Gamsberg", 1, today - timedelta(days=40), today - timedelta(days=37), today - timedelta(days=24), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(esc2["rr_id"], hod1()["id"], today - timedelta(days=41))
    esc2_id = esc2["records"][0]["id"]
    store.utilization_tracking.update(esc2_id, stage="ISSUED", qty_fulfilled=1, pr_id=pr_id, po_id=po_id, updated_at=now_iso())
    store.escalations.insert({"id": store.escalations.next_id(), "tracking_id": esc2["tracking_id"], "level": "HOD2",
                               "owner_id": hod2()["id"], "waiting_since": iso(today - timedelta(days=15)), "reminder_count": 3,
                               "status": "ACTIVE", "escalated_at": iso(today - timedelta(days=10)) + "T09:00:00+00:00"})
    store.utilization_exceptions.insert({"id": store.utilization_exceptions.next_id(), "tracking_id": esc2["tracking_id"],
                                          "type": "NO_RESPONSE", "severity": "CRITICAL", "plant": "Gamsberg",
                                          "department": r6["department"], "requester_id": r6["id"], "status": "OPEN",
                                          "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
                                          "note": "Requester has not responded to consumption confirmation reminders -- escalated to HOD2."})

    r7 = gsb_req[3 % len(gsb_req)]
    esc3 = make_plan(r7, "Gamsberg", r7["department"], seal, 1, "STRAIGHT",
                      "Mechanical seal, secondary crusher lubrication pump", today - timedelta(days=55),
                      equipment="Secondary Crusher Lube Pump")
    backdate_rr(esc3["rr_id"], today - timedelta(days=77))
    pr_id, po_id = create_pr_po(store.rr.get(esc3["rr_id"]), seal, "Gamsberg", 1, today - timedelta(days=75), today - timedelta(days=72), today - timedelta(days=58), "COMPLETED", "PO_CREATED", "DELIVERED")
    approve_doa(esc3["rr_id"], hod1()["id"], today - timedelta(days=76))
    esc3_id = esc3["records"][0]["id"]
    store.utilization_tracking.update(esc3_id, stage="ISSUED", qty_fulfilled=1, pr_id=pr_id, po_id=po_id, updated_at=now_iso())
    store.escalations.insert({"id": store.escalations.next_id(), "tracking_id": esc3["tracking_id"], "level": "INVENTORY_CONTROL",
                               "owner_id": admin()["id"], "waiting_since": iso(today - timedelta(days=40)), "reminder_count": 5,
                               "status": "ACTIVE", "escalated_at": iso(today - timedelta(days=20)) + "T09:00:00+00:00"})

    # --- Historical stock: predates consumption-plan capture, aged via GR date + grace period ---
    used_rr_ids = {cp["rr_id"] for cp in store.consumption_plans.all()}
    historical_candidates = [
        rr for rr in store.rr.all()
        if rr["status"] == "COMPLETED" and rr["trigger_type"] == "OAR_MANUAL" and rr["id"] not in used_rr_ids
    ][:2]
    for rr in historical_candidates:
        line = next(iter(store.rr_line_items.filter(lambda l: l["rr_id"] == rr["id"])), None)
        if line is None:
            continue
        material = store.materials.get(line["material_id"])
        classification, _ = svc.classify_material(material)
        if classification != "OAR":
            continue
        creation = date.fromisoformat(rr["creation_date"])
        planned = creation + timedelta(days=int(material.get("lead_time_days") or 14) + svc.GRACE_DAYS_BY_LEAD)
        plan_id = store.consumption_plans.next_id()
        store.consumption_plans.insert({
            "id": plan_id, "rr_id": rr["id"], "rr_line_id": line["id"], "reservation_number": str(70010000 + plan_id),
            "reservation_type": "STRAIGHT", "material_id": material["id"], "plant": rr["plant"], "department": rr["department"],
            "requester_id": rr["requester_id"], "quantity": line["quantity"], "purpose": "Historical / No Original Consumption Plan",
            "job_card_number": None, "project": None, "equipment": None, "criticality": material.get("criticality") or "MEDIUM",
            "planned_consumption_date": iso(planned), "notes": "Predates Initiative 13 consumption-plan capture.", "created_at": now_iso(),
        })
        rec_id = store.utilization_tracking.next_id()
        tracking_id = f"UTL-{today.year}-{1000 + plan_id}"
        stage = "AGED" if planned < today else "AWAITING_CONFIRMATION"
        store.utilization_tracking.insert({
            "id": rec_id, "tracking_id": tracking_id, "consumption_plan_id": plan_id, "rr_id": rr["id"], "rr_line_id": line["id"],
            "material_id": material["id"], "plant": rr["plant"], "department": rr["department"], "requester_id": rr["requester_id"],
            "fulfilment_leg": "PROCUREMENT", "qty_requested": line["quantity"], "qty_fulfilled": line["quantity"], "qty_consumed": 0,
            "pr_id": None, "po_id": None, "stage": stage, "planned_consumption_date": iso(planned), "actual_consumption_date": None,
            "replan_count": 0, "previous_planned_date": None, "replan_reason": None, "release_reason": None,
            "risk_score": 55, "risk_level": "MEDIUM", "risk_drivers": ["Historical record -- no captured consumption plan"],
            "historical": True, "created_at": rr["created_at"], "updated_at": now_iso(),
        })
        log_event(tracking_id, "HISTORICAL_IMPORT", "COMPLETED", None, None, "system",
                  "Historical / No Original Consumption Plan -- aged using goods-receipt date plus category grace period.")
        store.utilization_exceptions.insert({"id": store.utilization_exceptions.next_id(), "tracking_id": tracking_id,
                                              "type": "MISSING_LINKAGE", "severity": "MEDIUM", "plant": rr["plant"],
                                              "department": rr["department"], "requester_id": rr["requester_id"], "status": "OPEN",
                                              "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
                                              "note": "Historical stock with no captured project/equipment linkage."})

    print("Initiative 13 seed complete.")
    print(f"  consumption_plans: {len(store.consumption_plans.all())}")
    print(f"  utilization_tracking: {len(store.utilization_tracking.all())}")
    print(f"  utilization_events: {len(store.utilization_events.all())}")
    print(f"  unused_stock: {len(store.unused_stock.all())}")
    print(f"  redeployment_recommendations: {len(store.redeployment_recommendations.all())}")
    print(f"  utilization_exceptions: {len(store.utilization_exceptions.all())}")
    print(f"  escalations: {len(store.escalations.all())}")
    print(f"  unmatched_issues: {len(store.unmatched_issues.all())}")


if __name__ == "__main__":
    main()
