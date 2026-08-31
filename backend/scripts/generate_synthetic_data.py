"""Generate the synthetic Initiative-9 procurement dataset (RR -> DOA -> MRP -> PR -> RFQ ->
Ariba -> Auction -> NFA -> PO) as CSV files under backend/data/.

This is SEED DATA for local development/demo, not real SAP/Ariba data -- see README.md.
Deterministic: re-running with the same seed regenerates an identical dataset. Sourcing
sub-steps (RFQ/Ariba/Auction/NFA) are simulated to produce realistic stage timing and
supplier selection, but only their process_stage_events + resulting PR/PO rows are
persisted -- those sub-entities aren't part of the required CSV file set.

Also generates the Initiative-7 (predictive inventory / safety stock optimization)
extension tables -- see the "Initiative-7 extensions" section below and
Initiative_7_Data_Requirement_Sheet.pdf for the field-level rationale. These are additive:
consumption_history/goods_receipt/current_inventory/criticality_policy/maintenance_orders/
equipment_utilization/equipment are new files, and materials.csv gains new columns, but
none of rr/pr/po/approvals/audit_logs/notifications/process_stage_events are touched.

Usage:
    python scripts/generate_synthetic_data.py [--seed 12345]
    python scripts/generate_synthetic_data.py --only-initiative-7   # regenerate just the
        Initiative-7 tables + materials.csv's Initiative-7 columns, reusing the existing
        Initiative-9 procurement data on disk (requires a prior full run)

Suppliers and manufacturers are deliberately fictional (see catalog.py) -- this is fabricated
transaction/rating history and must never be attached to a real company's name.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from faker import Faker

from app.config import get_settings
from app.services import csv_store as cs
from app.services.csv_store import area_for_department
from scripts import catalog

MANAGER_ROLES = ["ENGINEERING_MANAGER", "COMMERCIAL_MANAGER"]
ROLE_WEIGHTS = {
    "END_USER": 0.58,
    "PROCUREMENT": 0.16,
    "ENGINEERING_MANAGER": 0.08,
    "COMMERCIAL_MANAGER": 0.06,
    "WAREHOUSE_SUPERVISOR": 0.09,
    "ADMIN": 0.03,
}

PATH_SCENARIO_WEIGHTS = {
    "normal": 0.44,
    "doa_bottleneck": 0.08,
    "mrp_bottleneck": 0.06,
    "rfq_bottleneck": 0.06,
    "ariba_bottleneck": 0.05,
    "nfa_bottleneck": 0.05,
    "multi_line_pr": 0.05,
    "long_open_pr": 0.05,
    "cancelled": 0.03,
    "rejected": 0.03,
    "escalated": 0.03,
    "aged_pending_approval": 0.07,
}

TARGET_COUNTS = {
    "users": 24,
    "materials": 220,
    "suppliers": 40,
    "rr": 650,
}


def weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    keys = list(weights.keys())
    return rng.choices(keys, weights=[weights[k] for k in keys], k=1)[0]


class IdSequence:
    def __init__(self, start: int = 1):
        self._next = start

    def next(self) -> int:
        value = self._next
        self._next += 1
        return value


class Rows:
    """Accumulates output rows per CSV file, in insertion order."""

    def __init__(self) -> None:
        self.data: dict[str, list[dict]] = {}

    def add(self, table: str, row: dict) -> None:
        self.data.setdefault(table, []).append(row)


# ---------------------------------------------------------------------------
# Reference/lookup generation
# ---------------------------------------------------------------------------


def generate_users(rng: random.Random, faker: Faker, rows: Rows) -> list[dict]:
    users: list[dict] = []
    seq = IdSequence(1)

    demo_accounts = [
        ("End User", "END_USER"),
        ("Engineering Manager", "ENGINEERING_MANAGER"),
        ("Commercial Manager", "COMMERCIAL_MANAGER"),
        ("Warehouse Supervisor", "WAREHOUSE_SUPERVISOR"),
        ("Procurement Officer", "PROCUREMENT"),
        ("System Admin", "ADMIN"),
    ]
    for i, (name, role) in enumerate(demo_accounts, start=1):
        user_id = seq.next()
        code = f"DEMO{i:03d}"
        users.append(
            {
                "id": user_id,
                "employee_code": code,
                "name": f"Demo {name}",
                "email": f"demo.{role.lower()}@spares-ai-demo.local",
                "department": rng.choice(catalog.DEPARTMENTS),
                "role": role,
                "plant": rng.choice(catalog.PLANTS),
                "active": True,
            }
        )

    while len(users) < TARGET_COUNTS["users"]:
        user_id = seq.next()
        first, last = faker.first_name(), faker.last_name()
        role = weighted_choice(rng, ROLE_WEIGHTS)
        users.append(
            {
                "id": user_id,
                "employee_code": f"EMP{user_id:05d}",
                "name": f"{first} {last}",
                "email": f"{first}.{last}{user_id}@spares-ai-demo.local".lower(),
                "department": rng.choice(catalog.DEPARTMENTS),
                "role": role,
                "plant": rng.choice(catalog.PLANTS),
                "active": rng.random() > 0.03,
            }
        )

    rows.data["users"] = users
    return users


def generate_materials(rng: random.Random, now_iso: str, rows: Rows) -> list[dict]:
    materials: list[dict] = []
    seq = IdSequence(1)
    combos = []
    for category, templates in catalog.MATERIAL_TEMPLATES.items():
        for tmpl in templates:
            for variant in tmpl["variants"]:
                combos.append((category, tmpl, variant))
    rng.shuffle(combos)

    manufacturers = [f"{p} {s}" for p in catalog.MANUFACTURER_NAME_PREFIXES for s in catalog.MANUFACTURER_NAME_SUFFIXES]
    rng.shuffle(manufacturers)

    idx = 0
    reserved_for_services = len(catalog.SERVICE_CODE_POOL)
    while len(materials) < TARGET_COUNTS["materials"] - reserved_for_services:
        category, tmpl, variant = combos[idx % len(combos)]
        plant = catalog.PLANTS[idx % len(catalog.PLANTS)]
        material_id = seq.next()
        variant_code = "".join(ch for ch in variant if ch.isdigit())[:2] or "00"
        description = tmpl["stem"].format(variant=variant, variant_code=variant_code)
        low, high = tmpl["price"]
        price = round(rng.uniform(low, high), 2)
        materials.append(
            {
                "id": material_id,
                "material_code": f"500-{10000 + material_id}",
                "description": description,
                "material_group": category,
                "material_type": tmpl["stem"].split(",")[0].format(variant="", variant_code="").strip(),
                "plant": plant,
                "storage_location": rng.choice(catalog.STORAGE_LOCATIONS_BY_PLANT[plant]),
                "unit_of_measure": tmpl["uom"],
                "criticality": tmpl["criticality"],
                "lifecycle_status": rng.choices(["Active", "EOL", "Obsolete"], weights=[0.82, 0.12, 0.06])[0],
                "service_code": None,
                "manufacturer": manufacturers[material_id % len(manufacturers)],
                "manufacturer_part_no": f"MP-{material_id:06d}",
                "last_po_price": price,
                "last_vendor": None,
                "stock_level": rng.randint(0, 40) if tmpl["uom"] == "EA" else rng.randint(0, 500),
                "lead_time_days": rng.choice([7, 10, 14, 21, 30, 45, 60]),
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )
        idx += 1

    for svc_code in catalog.SERVICE_CODE_POOL:
        if len(materials) >= TARGET_COUNTS["materials"]:
            break
        material_id = seq.next()
        category = svc_code.split("-")[1]
        plant = catalog.PLANTS[material_id % len(catalog.PLANTS)]
        materials.append(
            {
                "id": material_id,
                "material_code": f"500-{10000 + material_id}",
                "description": f"{category.title()} Service - contracted field technician",
                "material_group": "Services",
                "material_type": f"{category.title()} Service",
                "plant": plant,
                "storage_location": rng.choice(catalog.STORAGE_LOCATIONS_BY_PLANT[plant]),
                "unit_of_measure": "EA",
                "criticality": "MEDIUM",
                "lifecycle_status": "Active",
                "service_code": svc_code,
                "manufacturer": None,
                "manufacturer_part_no": None,
                "last_po_price": round(rng.uniform(3500, 45000), 2),
                "last_vendor": None,
                "stock_level": 0,
                "lead_time_days": rng.choice([3, 5, 7, 10]),
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    rows.data["materials"] = materials
    return materials


def generate_suppliers(rng: random.Random, rows: Rows) -> list[dict]:
    suppliers: list[dict] = []
    seq = IdSequence(1)
    used_names: set[str] = set()
    while len(suppliers) < TARGET_COUNTS["suppliers"]:
        name = f"{rng.choice(catalog.SUPPLIER_NAME_PREFIXES)} {rng.choice(catalog.SUPPLIER_NAME_SUFFIXES)}"
        if name in used_names:
            continue
        used_names.add(name)
        supplier_id = seq.next()
        suppliers.append(
            {
                "id": supplier_id,
                "supplier_code": f"SUP-{1000 + supplier_id}",
                "supplier_name": f"{name} (Pty) Ltd",
                "country": rng.choice(catalog.SUPPLIER_COUNTRIES),
                "category": rng.choice(catalog.SUPPLIER_CATEGORIES),
                "rating": round(rng.uniform(3.0, 5.0), 1),
                "active": rng.random() > 0.05,
            }
        )
    rows.data["suppliers"] = suppliers
    return suppliers


# ---------------------------------------------------------------------------
# Procurement pipeline generation
# ---------------------------------------------------------------------------


def pick_users_by_role(users: list[dict]) -> dict[str, list[dict]]:
    by_role: dict[str, list[dict]] = {}
    for u in users:
        by_role.setdefault(u["role"], []).append(u)
    return by_role


def duration_days(rng: random.Random, scenario: str, stage: str) -> int:
    bottleneck_map = {
        "DOA": ("doa_bottleneck", (12, 35), (1, 4)),
        "MRP": ("mrp_bottleneck", (10, 25), (1, 3)),
        "RFQ": ("rfq_bottleneck", (20, 45), (5, 10)),
        "ARIBA": ("ariba_bottleneck", (15, 40), (3, 7)),
        "NFA": ("nfa_bottleneck", (15, 30), (2, 5)),
    }
    trigger, bottleneck_range, normal_range = bottleneck_map[stage]
    lo, hi = bottleneck_range if scenario == trigger else normal_range
    return rng.randint(lo, hi)


def generate_pipeline(rng: random.Random, now: datetime, users: list[dict], users_by_role: dict[str, list[dict]], materials: list[dict], suppliers: list[dict], rows: Rows) -> None:
    physical_materials = [m for m in materials if m["material_group"] != "Services"]
    service_materials = [m for m in materials if m["material_group"] == "Services"]

    rr_seq, rrline_seq = IdSequence(1), IdSequence(1)
    pr_seq, prline_seq = IdSequence(1), IdSequence(1)
    po_seq, poline_seq = IdSequence(1), IdSequence(1)
    stage_event_seq = IdSequence(1)
    approval_seq = IdSequence(1)
    audit_seq = IdSequence(1)
    notif_seq = IdSequence(1)

    def add_audit(user_id: int | None, action: str, entity_type: str, entity_id: int, ts: datetime, new_value: dict | None = None) -> None:
        rows.add(
            "audit_logs",
            {
                "id": audit_seq.next(), "user_id": user_id, "action": action, "entity_type": entity_type,
                "entity_id": entity_id, "old_value": None, "new_value": new_value, "timestamp": ts.isoformat(),
                "ip_address": None, "device_metadata": "synthetic-seed",
            },
        )

    def add_notification(recipient_id: int, ntype: str, title: str, message: str, related_type: str, related_id: int, ts: datetime, read: bool) -> None:
        rows.add(
            "notifications",
            {
                "id": notif_seq.next(), "recipient_id": recipient_id, "type": ntype, "title": title, "message": message,
                "status": "READ" if read else "UNREAD", "related_entity_type": related_type, "related_entity_id": related_id,
                "created_at": ts.isoformat(), "read_at": (ts + timedelta(hours=rng.randint(1, 30))).isoformat() if read else None,
            },
        )

    def add_stage_event(entity_type: str, entity_id: int, stage_code: str, stage_name: str, started_at: datetime, completed_at: datetime | None, status: str, owner_id: int | None) -> None:
        rows.add(
            "process_stage_events",
            {
                "id": stage_event_seq.next(), "entity_type": entity_type, "entity_id": entity_id, "stage_code": stage_code,
                "stage_name": stage_name, "started_at": started_at.isoformat(), "completed_at": completed_at.isoformat() if completed_at else None,
                "status": status, "owner_id": owner_id, "source_system": "synthetic",
            },
        )

    def add_approval(approval_type: str, rr_id: int, approver: dict, status: str, urgency: str, submitted_at: datetime, action_at: datetime | None, comments: str | None, level: int = 1) -> None:
        rows.add(
            "approvals",
            {
                "id": approval_seq.next(), "approval_type": approval_type, "entity_type": "RR", "rr_id": rr_id, "pr_id": None,
                "po_id": None, "approval_level": level, "approver_id": approver["id"], "approver_role": approver["role"],
                "status": status, "match_tier": None, "urgency": urgency, "related_chat_session_id": None,
                "submitted_at": submitted_at.isoformat(), "action_at": action_at.isoformat() if action_at else None, "comments": comments,
            },
        )

    quality_reasons_vague = ["spares as required", "misc parts", "items per attached list", "as discussed"]

    for _ in range(TARGET_COUNTS["rr"]):
        rr_id = rr_seq.next()
        scenario = weighted_choice(rng, PATH_SCENARIO_WEIGHTS)
        requester = rng.choice(users)
        plant, department = requester["plant"], requester["department"]

        days_ago = rng.randint(20, 150) if scenario in ("long_open_pr", "aged_pending_approval") else rng.randint(1, 270)
        creation_dt = now - timedelta(days=days_ago, hours=rng.randint(0, 23))
        creation_date = creation_dt.date()
        required_date = creation_date + timedelta(days=rng.randint(14, 60))
        priority = rng.choices(["Normal", "High", "Critical"], weights=[0.65, 0.25, 0.10])[0]

        is_service_rr = rng.random() < 0.18
        line_pool = service_materials if is_service_rr else physical_materials
        trigger_type = "OAR_MANUAL" if rng.random() < 0.45 else "MIN_MAX_AUTO"

        line_count = rng.randint(5, 12) if scenario == "multi_line_pr" else rng.randint(1, 3)
        pr_line_rows: list[dict] = []
        total_value = 0.0
        for line_no in range(1, line_count + 1):
            material = rng.choice(line_pool)
            qty = rng.randint(1, 20)
            unit_price = round(float(material["last_po_price"]) * rng.uniform(0.92, 1.15), 2)
            description = material["description"]
            service_code = material["service_code"]
            quality_status = "OK"

            if rng.random() < 0.06:
                quality_status = "MISSING_SERVICE_CODE"
                service_code = None
            elif rng.random() < 0.05:
                quality_status = "VAGUE_DESCRIPTION"
                description = rng.choice(quality_reasons_vague)

            rows.add(
                "rr_line_items",
                {
                    "id": rrline_seq.next(), "rr_id": rr_id, "line_number": line_no, "material_id": material["id"],
                    "quantity": qty, "estimated_unit_price": unit_price, "service_code": service_code,
                    "description": description, "quality_status": quality_status,
                },
            )
            total_value += qty * unit_price
            pr_line_rows.append({"line_number": line_no, "material_id": material["id"], "quantity": qty, "unit_price": unit_price, "service_code": service_code, "description": description, "line_status": "OPEN", "quality_flags": quality_status if quality_status != "OK" else None})

        rr_row = {
            "id": rr_id, "rr_number": f"RR-{1000 + rr_id}", "requester_id": requester["id"], "plant": plant,
            "department": department, "area": area_for_department(department), "trigger_type": trigger_type,
            "creation_date": creation_date.isoformat(), "required_date": required_date.isoformat(),
            "purpose": f"{department} spares replenishment - {pr_line_rows[0]['description']}", "status": "IN_PROGRESS",
            "priority": priority, "total_estimated_value": round(total_value, 2), "source_system": "synthetic",
            "created_at": creation_dt.isoformat(), "updated_at": creation_dt.isoformat(),
        }
        rows.add("rr", rr_row)
        add_audit(requester["id"], "RR_CREATED", "RR", rr_id, creation_dt, {"rr_number": rr_row["rr_number"]})

        cursor = creation_dt
        add_stage_event("RR", rr_id, "RR_CREATED", "RR Created", cursor, cursor, "COMPLETED", requester["id"])

        def finalize_rr(status: str) -> None:
            rr_row["status"] = status
            rr_row["updated_at"] = now.isoformat()

        # --- DOA ---
        doa_approver = rng.choice(users_by_role[rng.choice(MANAGER_ROLES)])
        doa_started = cursor
        doa_days = duration_days(rng, scenario, "DOA")
        doa_completed = doa_started + timedelta(days=doa_days)

        if scenario == "rejected" and rng.random() < 0.5:
            add_stage_event("RR", rr_id, "DOA", "DOA Approval", doa_started, doa_completed, "REJECTED", doa_approver["id"])
            add_approval("DOA", rr_id, doa_approver, "REJECTED", priority, doa_started, doa_completed, "Rejected at DOA stage - insufficient justification (synthetic).")
            add_audit(doa_approver["id"], "DOA_REJECTED", "RR", rr_id, doa_completed)
            add_notification(requester["id"], "APPROVAL_RESULT", f"{rr_row['rr_number']} rejected", "Your requisition was rejected at DOA approval.", "RR", rr_id, doa_completed, read=rng.random() < 0.6)
            finalize_rr("REJECTED")
            continue

        if scenario == "cancelled" and rng.random() < 0.4:
            add_stage_event("RR", rr_id, "DOA", "DOA Approval", doa_started, None, "IN_PROGRESS", doa_approver["id"])
            add_audit(requester["id"], "RR_CANCELLED", "RR", rr_id, doa_started + timedelta(days=1))
            finalize_rr("CANCELLED")
            continue

        if scenario == "escalated":
            add_stage_event("RR", rr_id, "DOA", "DOA Approval", doa_started, None, "IN_PROGRESS", doa_approver["id"])
            add_approval("DOA", rr_id, doa_approver, "ESCALATED", priority, doa_started, doa_started + timedelta(days=2), "Escalated for further commercial review (synthetic).", level=2)
            add_audit(doa_approver["id"], "APPROVAL_ESCALATED", "RR", rr_id, doa_started + timedelta(days=2))
            finalize_rr("ESCALATED")
            continue

        doa_pending_now = scenario == "aged_pending_approval" or (scenario == "doa_bottleneck" and doa_completed > now)
        if doa_pending_now:
            add_stage_event("RR", rr_id, "DOA", "DOA Approval", doa_started, None, "IN_PROGRESS", doa_approver["id"])
            add_approval("DOA", rr_id, doa_approver, "PENDING", priority, doa_started, None, None)
            add_notification(doa_approver["id"], "APPROVAL_REQUEST", f"DOA approval needed: {rr_row['rr_number']}", "A requisition is waiting on your DOA approval.", "RR", rr_id, doa_started, read=False)
            finalize_rr("WAITING_DOA")
            continue

        add_stage_event("RR", rr_id, "DOA", "DOA Approval", doa_started, doa_completed, "COMPLETED", doa_approver["id"])
        add_approval("DOA", rr_id, doa_approver, "APPROVED", priority, doa_started, doa_completed, "Approved (synthetic).")
        add_audit(doa_approver["id"], "DOA_APPROVED", "RR", rr_id, doa_completed)
        add_notification(requester["id"], "APPROVAL_RESULT", f"{rr_row['rr_number']} approved", "Your requisition was approved at DOA.", "RR", rr_id, doa_completed, read=rng.random() < 0.7)
        cursor = doa_completed

        # --- MRP ---
        mrp_started = cursor
        mrp_days = duration_days(rng, scenario, "MRP")
        mrp_completed = mrp_started + timedelta(days=mrp_days)
        if (scenario == "mrp_bottleneck") and (mrp_completed > now):
            add_stage_event("RR", rr_id, "MRP", "MRP Processing", mrp_started, None, "IN_PROGRESS", None)
            finalize_rr("MRP_PROCESSING")
            continue
        add_stage_event("RR", rr_id, "MRP", "MRP Processing", mrp_started, mrp_completed, "COMPLETED", None)
        cursor = mrp_completed
        finalize_rr("COMPLETED")

        # --- PR ---
        buyer = rng.choice(users_by_role["PROCUREMENT"])
        pr_id = pr_seq.next()
        pr_created_at = cursor
        pr_total = sum(float(line["quantity"]) * float(line["unit_price"]) for line in pr_line_rows)

        def finalize_pr(pr_row: dict, status: str) -> None:
            pr_row["status"] = status

        pr_row = {
            "id": pr_id, "pr_number": f"PR-{2000 + pr_id}", "rr_id": rr_id, "creation_date": pr_created_at.date().isoformat(),
            "required_date": required_date.isoformat(), "status": "OPEN", "buyer_id": buyer["id"], "plant": plant,
            "total_value": round(pr_total, 2), "source_system": "synthetic",
        }
        rows.add("pr", pr_row)
        for line in pr_line_rows:
            rows.add("pr_line_items", {"id": prline_seq.next(), "pr_id": pr_id, **line})
        add_stage_event("PR", pr_id, "PR_CREATED", "PR Created", pr_created_at, pr_created_at, "COMPLETED", buyer["id"])
        add_audit(buyer["id"], "PR_CREATED", "PR", pr_id, pr_created_at, {"pr_number": pr_row["pr_number"]})

        if scenario == "long_open_pr":
            rfq_started = pr_created_at + timedelta(days=1)
            add_stage_event("PR", pr_id, "RFQ", "RFQ", rfq_started, None, "IN_PROGRESS", buyer["id"])
            finalize_pr(pr_row, "AWAITING_RFQ")
            continue

        cursor = pr_created_at
        has_rfq = scenario in {"rfq_bottleneck", "ariba_bottleneck", "nfa_bottleneck"} or rng.random() < 0.62
        selected_supplier = None
        invited_suppliers: list[dict] = []
        if has_rfq:
            rfq_started = cursor + timedelta(days=1)
            rfq_days = duration_days(rng, scenario, "RFQ")
            rfq_closed = rfq_started + timedelta(days=rfq_days)
            invited_suppliers = rng.sample(suppliers, k=min(len(suppliers), rng.randint(3, 6)))
            selected_supplier = rng.choice(invited_suppliers)
            add_stage_event("PR", pr_id, "RFQ", "RFQ", rfq_started, rfq_closed, "COMPLETED", buyer["id"])
            add_audit(buyer["id"], "RFQ_CLOSED", "PR", pr_id, rfq_closed)
            cursor = rfq_closed

            if scenario == "ariba_bottleneck" or rng.random() < 0.45:
                ariba_started = cursor + timedelta(days=1)
                ariba_days = duration_days(rng, scenario, "ARIBA")
                ariba_ended = ariba_started + timedelta(days=ariba_days)
                if scenario == "ariba_bottleneck" and ariba_ended > now:
                    add_stage_event("PR", pr_id, "ARIBA", "Ariba Event", ariba_started, None, "IN_PROGRESS", buyer["id"])
                    finalize_pr(pr_row, "AWAITING_ARIBA")
                    continue
                selected_supplier = rng.choice(invited_suppliers)
                add_stage_event("PR", pr_id, "ARIBA", "Ariba Event", ariba_started, ariba_ended, "COMPLETED", buyer["id"])
                cursor = ariba_ended

                if rng.random() < 0.6:
                    auction_started = cursor + timedelta(hours=rng.randint(2, 20))
                    auction_ended = auction_started + timedelta(hours=rng.randint(2, 8))
                    bidders = rng.sample(invited_suppliers, k=min(len(invited_suppliers), rng.randint(2, 4)))
                    selected_supplier = rng.choice(bidders)
                    add_stage_event("PR", pr_id, "AUCTION", "Auction", auction_started, auction_ended, "COMPLETED", buyer["id"])
                    cursor = auction_ended

        if selected_supplier is None:
            selected_supplier = rng.choice(suppliers)

        requires_nfa = scenario == "nfa_bottleneck" or rng.random() < 0.55
        if requires_nfa:
            nfa_approver = rng.choice(users_by_role["COMMERCIAL_MANAGER"])
            nfa_submitted = cursor + timedelta(days=1)
            nfa_days = duration_days(rng, scenario, "NFA")
            nfa_completed = nfa_submitted + timedelta(days=nfa_days)

            if scenario == "rejected":
                add_stage_event("PR", pr_id, "NFA", "NFA Approval", nfa_submitted, nfa_completed, "REJECTED", nfa_approver["id"])
                add_audit(nfa_approver["id"], "NFA_REJECTED", "PR", pr_id, nfa_completed)
                add_notification(buyer["id"], "APPROVAL_RESULT", f"NFA rejected for {pr_row['pr_number']}", "The NFA for this PR was rejected.", "PR", pr_id, nfa_completed, read=rng.random() < 0.5)
                finalize_pr(pr_row, "REJECTED")
                continue

            if scenario == "nfa_bottleneck" and nfa_completed > now:
                add_stage_event("PR", pr_id, "NFA", "NFA Approval", nfa_submitted, None, "IN_PROGRESS", nfa_approver["id"])
                add_notification(nfa_approver["id"], "APPROVAL_REQUEST", f"NFA approval needed: {pr_row['pr_number']}", "An NFA is waiting on your approval.", "PR", pr_id, nfa_submitted, read=False)
                finalize_pr(pr_row, "AWAITING_NFA")
                continue

            add_stage_event("PR", pr_id, "NFA", "NFA Approval", nfa_submitted, nfa_completed, "COMPLETED", nfa_approver["id"])
            add_audit(nfa_approver["id"], "NFA_APPROVED", "PR", pr_id, nfa_completed)
            cursor = nfa_completed

        # --- PO ---
        if rng.random() < 0.92:
            po_id = po_seq.next()
            po_created = cursor + timedelta(days=1)
            po_status = rng.choices(["OPEN", "PARTIALLY_DELIVERED", "COMPLETED"], weights=[0.4, 0.2, 0.4])[0]
            po_total = 0.0
            po_lines = []
            for line in pr_line_rows:
                line_total = round(float(line["quantity"]) * float(line["unit_price"]), 2)
                po_total += line_total
                delivery_date = po_created.date() + timedelta(days=rng.randint(7, 60))
                po_lines.append(
                    {
                        "id": poline_seq.next(), "po_id": po_id, "material_id": line["material_id"], "quantity": line["quantity"],
                        "unit_price": line["unit_price"], "line_total": line_total, "delivery_date": delivery_date.isoformat(),
                        "status": "DELIVERED" if po_status == "COMPLETED" else rng.choice(["OPEN", "DELIVERED"]),
                    }
                )
            rows.add(
                "po",
                {
                    "id": po_id, "po_number": f"PO-{3000 + po_id}", "pr_id": pr_id, "supplier_id": selected_supplier["id"],
                    "creation_date": po_created.date().isoformat(), "expected_delivery": (po_created.date() + timedelta(days=rng.randint(14, 60))).isoformat(),
                    "status": po_status, "total_value": round(po_total, 2), "buyer_id": buyer["id"],
                },
            )
            for pl in po_lines:
                rows.add("po_line_items", pl)
            add_stage_event("PR", pr_id, "PO_CREATED", "PO Created", po_created, po_created, "COMPLETED", buyer["id"])
            add_audit(buyer["id"], "PO_CREATED", "PO", po_id, po_created, {"po_number": f"PO-{3000+po_id}"})
            add_notification(requester["id"], "PO_CREATED", f"PO-{3000+po_id} created", "A purchase order has been created for your requisition.", "PO", po_id, po_created, read=rng.random() < 0.5)
            finalize_pr(pr_row, "PO_CREATED")
        else:
            finalize_pr(pr_row, "AWAITING_PO")


def backfill_material_last_purchase(materials: list[dict], suppliers: list[dict], rows: Rows) -> None:
    """Set last_vendor/last_po_price from the most recent PO line actually generated,
    mirroring how a real material master reflects the latest purchase, not a static seed value."""
    supplier_name_by_id = {s["id"]: s["supplier_name"] for s in suppliers}
    po_by_id = {po["id"]: po for po in rows.data.get("po", [])}
    latest_by_material: dict[int, tuple] = {}

    for line in rows.data.get("po_line_items", []):
        po = po_by_id.get(line["po_id"])
        if po is None:
            continue
        key = (po["creation_date"], line["id"])
        current = latest_by_material.get(line["material_id"])
        if current is None or key > current[0]:
            latest_by_material[line["material_id"]] = (key, po["supplier_id"], line["unit_price"])

    for material in materials:
        hit = latest_by_material.get(material["id"])
        if hit:
            _, supplier_id, unit_price = hit
            material["last_vendor"] = supplier_name_by_id.get(supplier_id)
            material["last_po_price"] = unit_price


# ---------------------------------------------------------------------------
# Initiative-7 extensions: predictive inventory & safety stock optimization.
#
# Everything below is additive on top of the Initiative-9 procurement dataset above -- see
# Initiative_7_Data_Requirement_Sheet.pdf for the field-level rationale. None of it is
# derived from rr/pr/po (those are procurement *events*); this section synthesizes the
# consumption/inventory/maintenance data those tables never captured, standing in for SAP
# tables (MSEG, EKBE, MARD, AFKO/RESB) that don't exist as extracts in this environment.
# ---------------------------------------------------------------------------

CIRCUITS = ["Crushing", "Milling", "Pumping", "Filtration"]

# material_group -> circuit, for the categories with an obvious real-world link. Everything
# else (Bearings, Valves, Motors, Conveyor Components, Electrical Spares, Instrumentation,
# Mechanical Seals, Services) is unbiased and gets balanced across all four circuits below.
CIRCUIT_GROUP_BIAS = {
    "Crusher Components": "Crushing",
    "Milling Components": "Milling",
    "Pumps": "Pumping",
    "Flotation Components": "Filtration",
}

EQUIPMENT_TYPES_BY_CIRCUIT = {
    "Crushing": ["Jaw Crusher", "Cone Crusher", "Gyratory Crusher"],
    "Milling": ["Ball Mill", "SAG Mill", "Rod Mill"],
    "Pumping": ["Slurry Pump", "Centrifugal Pump", "Diaphragm Pump"],
    "Filtration": ["Vacuum Filter", "Pressure Filter", "Belt Filter"],
}

DEMAND_PROFILE_WEIGHTS = {"smooth": 0.40, "erratic": 0.20, "intermittent": 0.25, "lumpy": 0.15}
MAINTENANCE_TYPE_WEIGHTS = {"Preventive": 0.50, "Corrective": 0.35, "Shutdown": 0.15}
MONTHS_OF_HISTORY = 24


def month_sequence(now: datetime, count: int = MONTHS_OF_HISTORY) -> list[str]:
    """count consecutive "YYYY-MM" periods ending at now's month, oldest first."""
    months = []
    year, month = now.year, now.month
    for offset in range(count - 1, -1, -1):
        m = month - offset
        y = year
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y:04d}-{m:02d}")
    return months


def assign_circuits(rng: random.Random, materials: list[dict]) -> dict[int, str]:
    """circuit -> Crushing/Milling/Pumping/Filtration, biased by material_group where a
    real-world link exists (Crusher/Milling/Pumps/Flotation Components), evenly spread
    otherwise. The unbiased materials are allocated by quota (largest-remainder method) so
    the *final* per-circuit mix lands within ~10% of an even split regardless of how the
    biased categories happen to be sized -- mirrors how a Circuit custom field would
    actually get populated/reviewed against SAP, not pure chance."""
    target = len(materials) / len(CIRCUITS)
    biased_counts = {c: 0 for c in CIRCUITS}
    assignment: dict[int, str] = {}
    flexible: list[int] = []

    for m in materials:
        circuit = CIRCUIT_GROUP_BIAS.get(m["material_group"])
        if circuit is None:
            flexible.append(m["id"])
        else:
            assignment[m["id"]] = circuit
            biased_counts[circuit] += 1

    remaining = {c: max(0.0, target - biased_counts[c]) for c in CIRCUITS}
    total_remaining = sum(remaining.values())

    if total_remaining > 0 and flexible:
        raw = {c: (remaining[c] / total_remaining) * len(flexible) for c in CIRCUITS}
        bag = [c for c in CIRCUITS for _ in range(int(raw[c]))]
        shortfall = len(flexible) - len(bag)
        by_fraction = sorted(CIRCUITS, key=lambda c: raw[c] - int(raw[c]), reverse=True)
        bag.extend(by_fraction[:shortfall])
    else:
        bag = [rng.choice(CIRCUITS) for _ in flexible]

    rng.shuffle(bag)
    for material_id, circuit in zip(flexible, bag):
        assignment[material_id] = circuit

    return assignment


def select_oar_materials(rng: random.Random, physical_materials: list[dict]) -> set[int]:
    """~10-15% of physical materials flagged One-and-Alike/non-moving, weighted toward rows
    that already look slow-moving/high-value in the existing synthetic data (Obsolete/EOL
    lifecycle, CRITICAL criticality, above-median price) rather than picked uniformly at
    random. Uses weighted reservoir sampling (A-Res: key = U^(1/weight), take the top keys)
    so the result is a proper weighted sample without replacement."""
    prices = sorted(float(m["last_po_price"]) for m in physical_materials)
    median_price = prices[len(prices) // 2]

    def weight(m: dict) -> float:
        w = 1.0
        if m["lifecycle_status"] in ("Obsolete", "EOL"):
            w += 3.0
        if m["criticality"] == "CRITICAL":
            w += 2.0
        if float(m["last_po_price"]) > median_price:
            w += 1.0
        return w

    target_count = round(len(physical_materials) * rng.uniform(0.10, 0.15))
    keyed = sorted(physical_materials, key=lambda m: rng.random() ** (1.0 / weight(m)), reverse=True)
    return {m["id"] for m in keyed[:target_count]}


def generate_equipment(rng: random.Random, rows: Rows) -> list[dict]:
    """Small equipment master so materials.equipment_id references something real instead
    of free text. Stands in for SAP EQUI/EQKT (equipment master), not part of this
    environment's extract."""
    equipment: list[dict] = []
    seq = IdSequence(1)
    per_cell = 6  # 4 circuits x 2 plants x 6 = 48, within the 40-60 target range
    for circuit in CIRCUITS:
        for plant in catalog.PLANTS:
            for _ in range(per_cell):
                equipment.append(
                    {
                        "equipment_id": f"EQ-{circuit[:4].upper()}-{seq.next():04d}",
                        "equipment_type": rng.choice(EQUIPMENT_TYPES_BY_CIRCUIT[circuit]),
                        "circuit": circuit,
                        "plant": plant,
                    }
                )
    rows.data["equipment"] = equipment
    return equipment


def extend_materials_initiative7(rng: random.Random, materials: list[dict], equipment: list[dict], rows: Rows) -> set[int]:
    """Adds the Initiative-7 columns to every existing material row in place -- ids and
    descriptions are untouched so existing rr_line_items/pr_line_items/po_line_items links
    stay valid. Returns the set of material ids flagged OAR."""
    circuits = assign_circuits(rng, materials)
    equipment_by_circuit_plant: dict[tuple[str, str], list[dict]] = {}
    for eq in equipment:
        equipment_by_circuit_plant.setdefault((eq["circuit"], eq["plant"]), []).append(eq)

    physical_materials = [m for m in materials if m["material_group"] != "Services"]
    oar_ids = select_oar_materials(rng, physical_materials)

    for m in materials:
        circuit = circuits[m["id"]]
        candidates = equipment_by_circuit_plant.get((circuit, m["plant"]), equipment)
        eq = rng.choice(candidates)
        m["equipment_id"] = eq["equipment_id"]
        m["equipment_type"] = eq["equipment_type"]
        m["circuit"] = circuit

        is_oar = m["id"] in oar_ids
        m["oar_flag"] = is_oar
        # Services aren't stock-managed (stock_level is always 0 for them, see
        # generate_materials) -- ROP/SS/Max only make sense for physical spares.
        if is_oar or m["material_group"] == "Services":
            m["current_rop"] = 0
            m["current_safety_stock"] = 0
            m["current_max_stock"] = 0
        else:
            rop = rng.randint(1, 15)
            m["current_rop"] = rop
            m["current_safety_stock"] = max(0, rop - rng.randint(1, 6))
            m["current_max_stock"] = rop + rng.randint(2, 20)
        # Requires client sign-off, not synthetic fabrication -- see criticality_policy.csv.
        m["service_level_target_pct"] = None

    return oar_ids


def pick_movement_type(rng: random.Random) -> str:
    if rng.random() < 0.70:
        return rng.choice(["261", "262"])  # production goods issue
    return rng.choice(["201", "202"])  # cost-center goods issue


def generate_consumption_history(rng: random.Random, now: datetime, physical_materials: list[dict], oar_ids: set[int], rows: Rows) -> tuple[dict[str, int], int]:
    """Synthetic MSEG-style goods-issue data -- no real SAP consumption extract exists in
    this environment. This is the input the Initiative-7 demand classification / SBA
    baseline / LightGBM challenger all depend on, so each material gets a deliberate hidden
    demand profile (not uniform randomness) to produce real ADI/CV^2 signal. OAR materials
    get sparse (0-4 non-zero months) history by design instead of a full profile."""
    months = month_sequence(now)
    rows_out: list[dict] = []
    profile_counts = {k: 0 for k in DEMAND_PROFILE_WEIGHTS}
    non_oar = [m for m in physical_materials if m["id"] not in oar_ids]

    profile_params = {
        "smooth": (0.95, 0.85, 1.15),
        "erratic": (0.92, 0.30, 2.50),
        "intermittent": (0.55, 0.60, 1.60),
        "lumpy": (0.35, 0.30, 3.00),
    }

    for material in non_oar:
        profile = weighted_choice(rng, DEMAND_PROFILE_WEIGHTS)
        profile_counts[profile] += 1
        presence_pct, low, high = profile_params[profile]
        base = rng.randint(2, 15)

        for period in months:
            if rng.random() > presence_pct:
                continue
            qty = max(1, round(base * rng.uniform(low, high)))
            rows_out.append(
                {
                    "material_id": material["id"], "period_month": period, "qty_consumed": qty,
                    "movement_type": pick_movement_type(rng), "plant": material["plant"],
                }
            )

    oar_physical = [m for m in physical_materials if m["id"] in oar_ids]
    for material in oar_physical:
        non_zero_months = rng.randint(0, 4)
        for period in rng.sample(months, k=non_zero_months) if non_zero_months else []:
            rows_out.append(
                {
                    "material_id": material["id"], "period_month": period, "qty_consumed": rng.randint(1, 3),
                    "movement_type": pick_movement_type(rng), "plant": material["plant"],
                }
            )

    rows.data["consumption_history"] = rows_out
    return profile_counts, len(non_oar)


def generate_goods_receipt(rng: random.Random, now: datetime, physical_materials: list[dict], oar_ids: set[int], suppliers: list[dict], rows: Rows) -> None:
    """Synthetic actual-delivery data -- stands in for a join of SAP EKKO/EKPO (PO) with
    EKBE movement-101 (goods receipt). po_line_items.status/delivery_date in the
    Initiative-9 dataset conflates planned vs actual, so lead-time variability analysis
    needs its own table with a real planned-vs-actual spread (~15% stddev around each
    material's assigned planned lead time)."""
    rows_out: list[dict] = []
    seq = IdSequence(1)
    non_oar = [m for m in physical_materials if m["id"] not in oar_ids]

    for material in non_oar:
        planned_lead_time = rng.randint(45, 150)
        for _ in range(rng.randint(4, 8)):
            supplier = rng.choice(suppliers)
            po_creation = (now - timedelta(days=rng.randint(30, 730))).date()
            actual_lead_time = max(1, round(rng.gauss(planned_lead_time, planned_lead_time * 0.15)))
            ordered_qty = rng.randint(1, 20)
            rows_out.append(
                {
                    "po_number": f"GR-PO-{seq.next():06d}", "material_id": material["id"],
                    "vendor": supplier["supplier_name"], "po_creation_date": po_creation.isoformat(),
                    "expected_delivery_date": (po_creation + timedelta(days=planned_lead_time)).isoformat(),
                    "goods_receipt_date": (po_creation + timedelta(days=actual_lead_time)).isoformat(),
                    "ordered_qty": ordered_qty, "received_qty": ordered_qty, "po_status": "DELIVERED",
                }
            )
    rows.data["goods_receipt"] = rows_out


def generate_current_inventory(rng: random.Random, materials: list[dict], rows: Rows) -> None:
    """Splits the single materials.stock_level figure into a realistic
    unrestricted/blocked/reserved/open-PO breakdown -- stands in for SAP MARD plus a
    RESB/EKPO open-quantity rollup, neither of which exist as separate tables here. Where a
    material has a real open (undelivered) PO line in po.csv/po_line_items.csv, that
    quantity is reused instead of a random one, for tighter internal consistency."""
    po_by_id = {po["id"]: po for po in rows.data.get("po", [])}
    open_po_by_material: dict[int, int] = {}
    for line in rows.data.get("po_line_items", []):
        po = po_by_id.get(line["po_id"])
        if po is None or po["status"] not in ("OPEN", "PARTIALLY_DELIVERED") or line["status"] != "OPEN":
            continue
        open_po_by_material[line["material_id"]] = open_po_by_material.get(line["material_id"], 0) + int(line["quantity"])

    rows_out: list[dict] = []
    for m in materials:
        if m["material_group"] == "Services":
            continue
        blocked = rng.randint(1, 3) if rng.random() < 0.20 else 0
        reserved = rng.randint(1, 4) if rng.random() < 0.30 else 0
        open_po_qty = open_po_by_material.get(m["id"])
        if open_po_qty is None:
            open_po_qty = rng.randint(1, 10) if rng.random() < 0.40 else 0
        rows_out.append(
            {
                "material_id": m["id"], "plant": m["plant"], "unrestricted_stock": m["stock_level"],
                "blocked_stock": blocked, "reserved_stock": reserved, "open_po_qty": open_po_qty,
            }
        )
    rows.data["current_inventory"] = rows_out


def generate_criticality_policy(materials: list[dict], rows: Rows) -> None:
    """The governing criticality x circuit -> service-level matrix -- structure only.
    Targets/Z-factors are LOCKED pending Vedanta business sign-off (see the Initiative-7
    data requirement sheet, items 38/8) and must never be fabricated here."""
    criticalities = sorted({m["criticality"] for m in materials if m["material_group"] != "Services"})
    rows.data["criticality_policy"] = [
        {"criticality": crit, "circuit": circuit, "service_level_target_pct": None, "z_factor": None, "status": "PENDING_SIGNOFF"}
        for crit in criticalities
        for circuit in CIRCUITS
    ]


def generate_maintenance_orders(rng: random.Random, now: datetime, physical_materials: list[dict], rows: Rows) -> None:
    """Forward-looking demand signal -- stands in for a join of SAP AFKO/AFIH (work order
    header) with RESB (material reservation), not part of this environment's extract.
    ~30-35% of materials get one upcoming work order; most don't."""
    seq = IdSequence(1)
    rows_out: list[dict] = []
    for material in physical_materials:
        if rng.random() >= 0.32:
            continue
        planned_date = (now + timedelta(days=rng.randint(30, 120))).date()
        rows_out.append(
            {
                "work_order": f"WO-{seq.next():06d}", "material_id": material["id"],
                "equipment_id": material["equipment_id"], "planned_date": planned_date.isoformat(),
                "required_qty": rng.randint(1, 10), "maintenance_type": weighted_choice(rng, MAINTENANCE_TYPE_WEIGHTS),
            }
        )
    rows.data["maintenance_orders"] = rows_out


def generate_equipment_utilization(rng: random.Random, now: datetime, equipment: list[dict], rows: Rows) -> None:
    """Synthetic operating-hours/utilization series -- stands in for an operational
    system (e.g. a DCS/historian) outside SAP; optional tier per the data requirement
    sheet, useful for LightGBM wear-based demand features. Each equipment gets a base
    utilization % with monthly noise, clipped to [20, 100]."""
    months = month_sequence(now)
    rows_out: list[dict] = []
    for eq in equipment:
        base = rng.uniform(55, 80)
        for period in months:
            pct = max(20.0, min(100.0, base + rng.uniform(-8, 8)))
            rows_out.append(
                {
                    "equipment_id": eq["equipment_id"], "period_month": period,
                    "operating_hours": round(pct * 7.2, 1), "utilization_pct": round(pct, 1),
                }
            )
    rows.data["equipment_utilization"] = rows_out


INITIATIVE7_TABLE_SCHEMAS = {
    "equipment": (["equipment_id", "equipment_type", "circuit", "plant"], {}),
    "consumption_history": (
        ["material_id", "period_month", "qty_consumed", "movement_type", "plant"],
        {"material_id": int, "qty_consumed": int},
    ),
    "goods_receipt": (
        [
            "po_number", "material_id", "vendor", "po_creation_date", "expected_delivery_date",
            "goods_receipt_date", "ordered_qty", "received_qty", "po_status",
        ],
        {"material_id": int, "ordered_qty": int, "received_qty": int},
    ),
    "current_inventory": (
        ["material_id", "plant", "unrestricted_stock", "blocked_stock", "reserved_stock", "open_po_qty"],
        {"material_id": int, "unrestricted_stock": int, "blocked_stock": int, "reserved_stock": int, "open_po_qty": int},
    ),
    "criticality_policy": (["criticality", "circuit", "service_level_target_pct", "z_factor", "status"], {}),
    "maintenance_orders": (
        ["work_order", "material_id", "equipment_id", "planned_date", "required_qty", "maintenance_type"],
        {"material_id": int, "required_qty": int},
    ),
    "equipment_utilization": (
        ["equipment_id", "period_month", "operating_hours", "utilization_pct"],
        {"operating_hours": float, "utilization_pct": float},
    ),
}
INITIATIVE7_WRITE_ORDER = list(INITIATIVE7_TABLE_SCHEMAS.keys())


def persist_initiative7(rows: Rows, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for name in INITIATIVE7_WRITE_ORDER:
        columns, types = INITIATIVE7_TABLE_SCHEMAS[name]
        table = cs.Table(data_dir / f"{name}.csv", columns, types)
        table.replace_all(rows.data.get(name, []))
        print(f"  wrote {len(rows.data.get(name, [])):>6} rows -> {name}.csv")


TABLE_SCHEMAS = {
    "users": (cs.USERS_COLUMNS, cs.USERS_TYPES),
    "materials": (cs.MATERIALS_COLUMNS, cs.MATERIALS_TYPES),
    "suppliers": (cs.SUPPLIERS_COLUMNS, cs.SUPPLIERS_TYPES),
    "rr": (cs.RR_COLUMNS, cs.RR_TYPES),
    "rr_line_items": (cs.RR_LINE_ITEMS_COLUMNS, cs.RR_LINE_ITEMS_TYPES),
    "pr": (cs.PR_COLUMNS, cs.PR_TYPES),
    "pr_line_items": (cs.PR_LINE_ITEMS_COLUMNS, cs.PR_LINE_ITEMS_TYPES),
    "po": (cs.PO_COLUMNS, cs.PO_TYPES),
    "po_line_items": (cs.PO_LINE_ITEMS_COLUMNS, cs.PO_LINE_ITEMS_TYPES),
    "process_stage_events": (cs.PROCESS_STAGE_EVENTS_COLUMNS, cs.PROCESS_STAGE_EVENTS_TYPES),
    "approvals": (cs.APPROVALS_COLUMNS, cs.APPROVALS_TYPES),
    "audit_logs": (cs.AUDIT_LOGS_COLUMNS, cs.AUDIT_LOGS_TYPES),
    "notifications": (cs.NOTIFICATIONS_COLUMNS, cs.NOTIFICATIONS_TYPES),
}

WRITE_ORDER = list(TABLE_SCHEMAS.keys())


def persist(rows: Rows, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for name in WRITE_ORDER:
        columns, types = TABLE_SCHEMAS[name]
        table = cs.Table(data_dir / f"{name}.csv", columns, types)
        table.replace_all(rows.data.get(name, []))
        print(f"  wrote {len(rows.data.get(name, [])):>6} rows -> {name}.csv")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=None, help="Override SYNTHETIC_DATA_SEED")
    parser.add_argument(
        "--only-initiative-7",
        action="store_true",
        help=(
            "Regenerate only the Initiative-7 tables (equipment/consumption_history/goods_receipt/"
            "current_inventory/criticality_policy/maintenance_orders/equipment_utilization) plus the "
            "Initiative-7 columns on materials.csv, reusing the existing Initiative-9 procurement data "
            "on disk instead of regenerating it. Requires a prior full run."
        ),
    )
    args = parser.parse_args()

    settings = get_settings()
    seed = args.seed if args.seed is not None else settings.synthetic_data_seed
    rng = random.Random(seed)
    faker = Faker()
    faker.seed_instance(seed)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    rows = Rows()

    if args.only_initiative_7:
        print(f"Regenerating Initiative-7 tables only (seed={seed}), reusing existing procurement data ...")
        materials_path = settings.data_dir / "materials.csv"
        if not materials_path.exists():
            raise SystemExit("materials.csv not found -- run a full generation first (without --only-initiative-7).")
        # Load only the base (Initiative-9) columns -- every Initiative-7 column is
        # recomputed fresh below, not carried over from a previous run.
        base_columns = [c for c in cs.MATERIALS_COLUMNS if c not in cs.INITIATIVE7_MATERIALS_COLUMNS]
        materials = cs.Table(materials_path, base_columns, cs.MATERIALS_TYPES).all()
        suppliers = cs.Table(settings.data_dir / "suppliers.csv", cs.SUPPLIERS_COLUMNS, cs.SUPPLIERS_TYPES).all()
        rows.data["po"] = cs.Table(settings.data_dir / "po.csv", cs.PO_COLUMNS, cs.PO_TYPES).all()
        rows.data["po_line_items"] = cs.Table(settings.data_dir / "po_line_items.csv", cs.PO_LINE_ITEMS_COLUMNS, cs.PO_LINE_ITEMS_TYPES).all()
    else:
        print(f"Generating synthetic Initiative-9 dataset with SEED={seed} ...")
        users = generate_users(rng, faker, rows)
        materials = generate_materials(rng, now_iso, rows)
        suppliers = generate_suppliers(rng, rows)
        users_by_role = pick_users_by_role(users)

        generate_pipeline(rng, now, users, users_by_role, materials, suppliers, rows)
        backfill_material_last_purchase(materials, suppliers, rows)

    print("Generating Initiative-7 predictive-inventory tables ...")
    equipment = generate_equipment(rng, rows)
    oar_ids = extend_materials_initiative7(rng, materials, equipment, rows)
    rows.data["materials"] = materials
    physical_materials = [m for m in materials if m["material_group"] != "Services"]

    profile_counts, non_oar_count = generate_consumption_history(rng, now, physical_materials, oar_ids, rows)
    generate_goods_receipt(rng, now, physical_materials, oar_ids, suppliers, rows)
    generate_current_inventory(rng, materials, rows)
    generate_criticality_policy(materials, rows)
    generate_maintenance_orders(rng, now, physical_materials, rows)
    generate_equipment_utilization(rng, now, equipment, rows)

    print("Writing CSV files ...")
    if args.only_initiative_7:
        # Only rewrite materials.csv (Initiative-7 columns updated) -- rr/pr/po/approvals/
        # audit_logs/notifications/process_stage_events stay untouched on disk.
        columns, types = TABLE_SCHEMAS["materials"]
        cs.Table(settings.data_dir / "materials.csv", columns, types).replace_all(materials)
        print(f"  wrote {len(materials):>6} rows -> materials.csv (Initiative-7 columns updated)")
    else:
        persist(rows, settings.data_dir)
    persist_initiative7(rows, settings.data_dir)

    oar_count = len(oar_ids)
    print("\nInitiative-7 summary:")
    print(f"  equipment                {len(rows.data.get('equipment', [])):>6}")
    print(f"  consumption_history      {len(rows.data.get('consumption_history', [])):>6}")
    print(f"  goods_receipt            {len(rows.data.get('goods_receipt', [])):>6}")
    print(f"  current_inventory        {len(rows.data.get('current_inventory', [])):>6}")
    print(f"  criticality_policy       {len(rows.data.get('criticality_policy', [])):>6}")
    print(f"  maintenance_orders       {len(rows.data.get('maintenance_orders', [])):>6}")
    print(f"  equipment_utilization    {len(rows.data.get('equipment_utilization', [])):>6}")
    print(f"  oar_flag materials       {oar_count:>6} / {len(physical_materials)} physical ({oar_count / len(physical_materials):.1%})")
    print("  demand profile mix (non-OAR physical materials):")
    for profile, target_weight in DEMAND_PROFILE_WEIGHTS.items():
        n = profile_counts.get(profile, 0)
        pct = n / non_oar_count if non_oar_count else 0.0
        print(f"    {profile:<12} {n:>4} ({pct:.1%}, target {target_weight:.0%})")

    if not args.only_initiative_7:
        print("\nDone. Row counts:")
        for name in WRITE_ORDER:
            print(f"  {name:<24} {len(rows.data.get(name, [])):>6}")


if __name__ == "__main__":
    main()
