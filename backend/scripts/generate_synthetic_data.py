"""Generate the synthetic Initiative-9 procurement dataset (RR -> DOA -> MRP -> PR -> RFQ ->
Ariba -> Auction -> NFA -> PO) as CSV files under backend/data/.

This is SEED DATA for local development/demo, not real SAP/Ariba data -- see README.md.
Deterministic: re-running with the same seed regenerates an identical dataset. Sourcing
sub-steps (RFQ/Ariba/Auction/NFA) are simulated to produce realistic stage timing and
supplier selection, but only their process_stage_events + resulting PR/PO rows are
persisted -- those sub-entities aren't part of the required CSV file set.

Usage:
    python scripts/generate_synthetic_data.py [--seed 12345]

Suppliers and manufacturers are deliberately fictional (see catalog.py) -- this is fabricated
transaction/rating history and must never be attached to a real company's name.
"""

from __future__ import annotations

import argparse
import random
import sys
from collections import defaultdict
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
    "normal": 0.38,
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
    # --- Initiative 8: duplicate-spend scenarios -------------------------------
    # Both raise a NEW-BUY requisition for a material that already has an open repair
    # chain at the same plant -- the exact condition the duplicate guard exists to catch
    # (Initiative 8 test scenarios 4 and 3 respectively).
    "duplicate_manual": 0.04,
    "duplicate_mrp": 0.02,
}

TARGET_COUNTS = {
    "users": 24,
    "materials": 220,
    "suppliers": 40,
    "rr": 650,
    "repair_chains": 46,
}

# --- Initiative 8: the repairable population -------------------------------
# Only categories that are genuinely refurbished rather than replaced. Bearings,
# electrical spares, instrumentation and conveyor components stay new-buy.
# PENDING VZI CONFIRMATION -- see the Initiative 8 build plan, input #1.
REPAIRABLE_GROUPS = {
    "Pumps", "Motors", "Valves", "Mechanical Seals", "Crusher Components", "Milling Components",
}
# Share of materials *within* those groups that carry the 80-series convention. Tuned so
# the repairable population lands near 16% of the catalogue overall.
REPAIRABLE_SHARE_WITHIN_GROUP = 0.35
# Repair cost as a fraction of a new unit -- fallback only; the economic evaluation
# prefers the actual repair PO value where one exists. PENDING VZI (build plan input #3).
REPAIR_COST_FACTOR_RANGE = (0.28, 0.45)
# Vendor turnaround. PENDING VZI (build plan input #2).
REPAIR_TURNAROUND_DAYS = (21, 60)

REPAIR_CHAIN_OUTCOME_WEIGHTS = {
    "in_flight": 0.44,   # open repair PO, unit due back in the future
    "overdue": 0.16,     # open repair PO, expected return already passed
    "returned": 0.40,    # chain closed -- proves detection is live, not historical
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

        # Initiative 8: repairables carry the 80-series code convention. Repairability is
        # never stored as a flag -- the code IS the identifier, exactly as it is in SAP.
        repairable = category in REPAIRABLE_GROUPS and rng.random() < REPAIRABLE_SHARE_WITHIN_GROUP
        code_prefix = "80" if repairable else "500"

        stock_level = rng.randint(0, 40) if tmpl["uom"] == "EA" else rng.randint(0, 500)
        # Reorder point straddles stock on hand, so a meaningful share of repairables sit
        # at or below the trigger -- those are the ones MRP would re-raise while a repair
        # is still out, which is the whole failure mode.
        reorder_point = max(0, stock_level + rng.randint(-8, 5))

        materials.append(
            {
                "id": material_id,
                "material_code": f"{code_prefix}-{10000 + material_id}",
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
                "stock_level": stock_level,
                "reorder_point": reorder_point,
                "lead_time_days": rng.choice([7, 10, 14, 21, 30, 45, 60]),
                "repair_cost_factor": round(rng.uniform(*REPAIR_COST_FACTOR_RANGE), 3) if repairable else None,
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
                "reorder_point": 0,
                "lead_time_days": rng.choice([3, 5, 7, 10]),
                "repair_cost_factor": None,  # services are never a repairable population
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

    # ================= Initiative 8: repair chains =============================
    # Repair documents are raised directly against a failed unit -- they do not originate
    # from an RR, so `rr_id` is null (mirroring SAP, where a repair PR is its own document
    # with its own number range). They deliberately produce NO process_stage_events: the
    # RR->PO cycle-time instrumentation measures new procurement, and mixing refurbishment
    # into it would silently change what every existing analytic means.
    repairable_materials = [m for m in materials if cs.is_repairable_code(m["material_code"])]
    open_chain_pool: list[dict] = []  # (material, plant) pairs with a chain open RIGHT NOW

    for _ in range(TARGET_COUNTS["repair_chains"] if repairable_materials else 0):
        material = rng.choice(repairable_materials)
        chain_plant = material["plant"]
        supplier = rng.choice(suppliers)
        repair_buyer = rng.choice(users_by_role["PROCUREMENT"])
        outcome = weighted_choice(rng, REPAIR_CHAIN_OUTCOME_WEIGHTS)
        qty = rng.randint(1, 3)
        unit_repair_cost = round(float(material["last_po_price"]) * float(material["repair_cost_factor"]), 2)
        turnaround = rng.randint(*REPAIR_TURNAROUND_DAYS)

        if outcome == "in_flight":
            opened_days_ago = rng.randint(3, turnaround - 3)
        elif outcome == "overdue":
            opened_days_ago = turnaround + rng.randint(8, 45)
        else:  # returned -- chain closed, unit is back on the shelf
            opened_days_ago = turnaround + rng.randint(20, 160)

        opened_at = now - timedelta(days=opened_days_ago, hours=rng.randint(0, 23))

        # A minority of in-flight chains are still at requisition stage with no PO yet --
        # an open repair PR is just as much an active chain as an open repair PO.
        pr_only = outcome == "in_flight" and rng.random() < 0.18

        repair_pr_id = pr_seq.next()
        repair_pr_number = f"RPR-{2000 + repair_pr_id}"
        rows.add(
            "pr",
            {
                "id": repair_pr_id, "pr_number": repair_pr_number, "rr_id": None,
                "creation_date": opened_at.date().isoformat(),
                "required_date": (opened_at.date() + timedelta(days=turnaround)).isoformat(),
                "status": "AWAITING_PO" if pr_only else "PO_CREATED",
                "buyer_id": repair_buyer["id"], "plant": chain_plant,
                "total_value": round(qty * unit_repair_cost, 2), "source_system": "synthetic",
                "doc_type": cs.DOC_TYPE_REPAIR, "duplicate_flag": False, "duplicate_context": None,
            },
        )
        rows.add(
            "pr_line_items",
            {
                "id": prline_seq.next(), "pr_id": repair_pr_id, "material_id": material["id"],
                "quantity": qty, "unit_price": unit_repair_cost, "service_code": None,
                "description": f"Repair / refurbishment - {material['description']}",
                "line_status": "OPEN" if outcome != "returned" else "CLOSED", "quality_flags": None,
            },
        )
        add_audit(repair_buyer["id"], "REPAIR_PR_CREATED", "PR", repair_pr_id, opened_at,
                  {"pr_number": repair_pr_number, "material_code": material["material_code"]})

        repair_po_number = None
        repair_po_id = None
        expected_return = None
        if not pr_only:
            repair_po_id = po_seq.next()
            repair_po_number = f"RPO-{3000 + repair_po_id}"
            po_created = opened_at + timedelta(days=rng.randint(1, 5))
            expected_return = po_created.date() + timedelta(days=turnaround)
            returned = outcome == "returned"
            rows.add(
                "po",
                {
                    "id": repair_po_id, "po_number": repair_po_number, "pr_id": repair_pr_id,
                    "supplier_id": supplier["id"], "creation_date": po_created.date().isoformat(),
                    "expected_delivery": expected_return.isoformat(),
                    "status": "COMPLETED" if returned else "OPEN",
                    "total_value": round(qty * unit_repair_cost, 2), "buyer_id": repair_buyer["id"],
                    "doc_type": cs.DOC_TYPE_REPAIR,
                },
            )
            rows.add(
                "po_line_items",
                {
                    "id": poline_seq.next(), "po_id": repair_po_id, "material_id": material["id"],
                    "quantity": qty, "unit_price": unit_repair_cost,
                    "line_total": round(qty * unit_repair_cost, 2),
                    "delivery_date": expected_return.isoformat(),
                    "status": "DELIVERED" if returned else "OPEN",
                },
            )
            add_audit(repair_buyer["id"], "REPAIR_PO_CREATED", "PO", repair_po_id, po_created,
                      {"po_number": repair_po_number, "vendor": supplier["supplier_name"]})

        if outcome in ("in_flight", "overdue"):
            # Shaped EXACTLY like repair_service.collect_open_chains() emits, so a seeded
            # duplicate_context and one written at runtime are the same structure and the
            # UI has a single shape to render.
            open_chain_pool.append(
                {
                    "material": material,
                    "plant": chain_plant,
                    "chain": {
                        "material_id": material["id"],
                        "material_code": material["material_code"],
                        "material_description": material["description"],
                        "material_group": material["material_group"],
                        "plant": chain_plant,
                        "repair_pr_number": repair_pr_number,
                        "repair_pr_id": repair_pr_id,
                        "repair_po_number": repair_po_number,
                        "repair_po_id": repair_po_id if not pr_only else None,
                        "supplier_id": supplier["id"] if not pr_only else None,
                        "vendor": supplier["supplier_name"] if not pr_only else None,
                        "quantity_under_repair": float(qty),
                        "repair_value": round(qty * unit_repair_cost, 2),
                        "opened_at": opened_at.date().isoformat(),
                        "expected_return": expected_return.isoformat() if expected_return else None,
                        "days_open": (now.date() - opened_at.date()).days,
                        "days_overdue": max((now.date() - expected_return).days, 0) if expected_return else 0,
                        "overdue": outcome == "overdue",
                        "stage": "AWAITING_VENDOR_DISPATCH" if pr_only else "AT_VENDOR",
                    },
                }
            )

    for _ in range(TARGET_COUNTS["rr"]):
        rr_id = rr_seq.next()
        scenario = weighted_choice(rng, PATH_SCENARIO_WEIGHTS)

        # A duplicate scenario is only meaningful if there is a chain to collide with.
        duplicate_chain = None
        if scenario in ("duplicate_manual", "duplicate_mrp"):
            if open_chain_pool:
                duplicate_chain = rng.choice(open_chain_pool)
            else:
                scenario = "normal"

        if duplicate_chain is not None:
            same_plant = [u for u in users if u["plant"] == duplicate_chain["plant"]] or users
            requester = rng.choice(same_plant)
            plant = duplicate_chain["plant"]
            department = requester["department"]
        else:
            requester = rng.choice(users)
            plant, department = requester["plant"], requester["department"]

        if duplicate_chain is not None:
            days_ago = rng.randint(1, 25)  # recent, so the collision reads as live
        else:
            days_ago = rng.randint(20, 150) if scenario in ("long_open_pr", "aged_pending_approval") else rng.randint(1, 270)
        creation_dt = now - timedelta(days=days_ago, hours=rng.randint(0, 23))
        creation_date = creation_dt.date()
        required_date = creation_date + timedelta(days=rng.randint(14, 60))
        priority = rng.choices(["Normal", "High", "Critical"], weights=[0.65, 0.25, 0.10])[0]

        is_service_rr = duplicate_chain is None and rng.random() < 0.18
        line_pool = service_materials if is_service_rr else physical_materials

        if scenario == "duplicate_manual":
            trigger_type = "OAR_MANUAL"      # a requisitioner raised it by hand
        elif scenario == "duplicate_mrp":
            trigger_type = "MIN_MAX_AUTO"    # stock fell below ROP while the unit was out
        else:
            trigger_type = "OAR_MANUAL" if rng.random() < 0.45 else "MIN_MAX_AUTO"

        if duplicate_chain is not None:
            line_count = 1
        else:
            line_count = rng.randint(5, 12) if scenario == "multi_line_pr" else rng.randint(1, 3)
        pr_line_rows: list[dict] = []
        total_value = 0.0
        for line_no in range(1, line_count + 1):
            # A duplicate requisition is, by definition, for the very material already out
            # for repair -- that identity is what the guard joins on.
            material = duplicate_chain["material"] if duplicate_chain is not None else rng.choice(line_pool)
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
            "duplicate_flag": False, "duplicate_context": None,
            "created_at": creation_dt.isoformat(), "updated_at": creation_dt.isoformat(),
        }

        # Initiative 8: the guard fires at creation and the requisition is FLAGGED, never
        # blocked -- the duplicate context then travels with the document to the approver.
        if duplicate_chain is not None:
            chain = duplicate_chain["chain"]
            rr_row["duplicate_flag"] = True
            rr_row["duplicate_context"] = {
                "detected_at": creation_dt.isoformat(),
                "plant": duplicate_chain["plant"],
                "chain_count": 1,
                "materials": [
                    {
                        "material_id": chain["material_id"],
                        "material_code": chain["material_code"],
                        "material_description": chain["material_description"],
                        "plant": duplicate_chain["plant"],
                        "is_repairable": True,
                        "has_active_chain": True,
                        "total_quantity_under_repair": chain["quantity_under_repair"],
                        "earliest_expected_return": chain["expected_return"],
                        "chains": [chain],
                    }
                ],
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

        doa_pending_now = (
            scenario in ("aged_pending_approval", "duplicate_mrp")
            or (scenario == "doa_bottleneck" and doa_completed > now)
            # Keep a good share of manual duplicates sitting in the approval queue, so the
            # approver-alert path always has live content to demonstrate.
            or (scenario == "duplicate_manual" and rng.random() < 0.45)
        )
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
            "doc_type": cs.DOC_TYPE_NEW_BUY,
            "duplicate_flag": rr_row["duplicate_flag"],
            "duplicate_context": rr_row["duplicate_context"],
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
                    "doc_type": cs.DOC_TYPE_NEW_BUY,
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
    mirroring how a real material master reflects the latest purchase, not a static seed value.

    Repair POs are excluded on purpose: a refurbishment costs a fraction of a new unit, so
    letting one land in `last_po_price` would corrupt the new-buy price the economic
    evaluation compares against -- and would make every repair look free."""
    supplier_name_by_id = {s["id"]: s["supplier_name"] for s in suppliers}
    po_by_id = {po["id"]: po for po in rows.data.get("po", [])}
    latest_by_material: dict[int, tuple] = {}

    for line in rows.data.get("po_line_items", []):
        po = po_by_id.get(line["po_id"])
        if po is None or po.get("doc_type") == cs.DOC_TYPE_REPAIR:
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


def generate_attestations(
    rng: random.Random, now: datetime, materials: list[dict], users_by_role: dict[str, list[dict]], rows: Rows
) -> None:
    """Initiative 8 SS3.2 -- the condition-to-repair declaration.

    Runs as a post-pass over the finished RR set so the MRP rule can be applied to each
    requisition's FINAL state rather than guessed mid-flight:

      * manual (OAR_MANUAL) requisitions are declared by the requisitioner at creation --
        the RR could not have been raised otherwise, so these are always COMPLETE;
      * auto-raised (MIN_MAX_AUTO) requisitions cannot be declared by MRP. Those that have
        already moved past DOA were declared by a planner on the way through; those still
        sitting at DOA carry a PENDING declaration that BLOCKS approval until completed.
    """
    material_by_id = {m["id"]: m for m in materials}
    lines_by_rr: dict[int, list[dict]] = defaultdict(list)
    for line in rows.data.get("rr_line_items", []):
        lines_by_rr[line["rr_id"]].append(line)

    planners = users_by_role.get("PROCUREMENT") or []
    seq = IdSequence(1)

    for rr in rows.data.get("rr", []):
        repairable_lines = [
            line for line in lines_by_rr.get(rr["id"], [])
            if cs.is_repairable_code((material_by_id.get(line["material_id"]) or {}).get("material_code"))
        ]
        if not repairable_lines:
            continue

        primary = repairable_lines[0]
        created_at = datetime.fromisoformat(rr["created_at"])
        is_mrp = rr.get("trigger_type") == "MIN_MAX_AUTO"
        pending = is_mrp and rr["status"] in ("WAITING_DOA", "ESCALATED")

        if pending:
            origin, status = cs.ATTESTATION_ORIGIN_MRP, cs.ATTESTATION_STATUS_PENDING
            declared_by, declared_at = None, None
        else:
            status = cs.ATTESTATION_STATUS_COMPLETE
            if is_mrp:
                origin = cs.ATTESTATION_ORIGIN_MRP
                declarer = rng.choice(planners) if planners else None
                declared_by = declarer["id"] if declarer else rr["requester_id"]
                declared_at = (created_at + timedelta(days=rng.randint(1, 4))).isoformat()
            else:
                origin = cs.ATTESTATION_ORIGIN_MANUAL
                declared_by = rr["requester_id"]
                declared_at = created_at.isoformat()

        rows.add(
            "attestations",
            {
                "id": seq.next(), "rr_id": rr["id"], "material_id": primary["material_id"],
                "plant": rr["plant"], "origin": origin, "status": status,
                "statement": cs.ATTESTATION_STATEMENT if status == cs.ATTESTATION_STATUS_COMPLETE else None,
                "declared_by": declared_by, "declared_at": declared_at,
                # What the guard saw at the moment of creation, frozen against the record.
                "chain_snapshot": rr.get("duplicate_context"),
                "created_at": created_at.isoformat(),
            },
        )


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
    "attestations": (cs.ATTESTATIONS_COLUMNS, cs.ATTESTATIONS_TYPES),
}

WRITE_ORDER = list(TABLE_SCHEMAS.keys())


def verify_initiative_8_dataset(materials: list[dict], rows: Rows) -> None:
    """Fail loudly if the generated dataset can't actually demonstrate Initiative 8.

    A run that produces zero open repair chains, or zero seeded duplicates, still writes
    perfectly valid CSVs -- and the problem only surfaces later as an empty register. This
    turns that into an immediate, obvious failure at generation time."""
    repairables = [m for m in materials if cs.is_repairable_code(m["material_code"])]
    repair_prs = [p for p in rows.data.get("pr", []) if p.get("doc_type") == cs.DOC_TYPE_REPAIR]
    repair_pos = [p for p in rows.data.get("po", []) if p.get("doc_type") == cs.DOC_TYPE_REPAIR]
    open_repair_pos = [p for p in repair_pos if p["status"] in ("OPEN", "PARTIALLY_DELIVERED")]
    flagged_rrs = [r for r in rows.data.get("rr", []) if r.get("duplicate_flag")]
    attestations = rows.data.get("attestations", [])
    pending = [a for a in attestations if a["status"] == cs.ATTESTATION_STATUS_PENDING]

    problems = []
    if not repairables:
        problems.append("no repairable (80-series) materials were generated")
    if not repair_prs:
        problems.append("no repair PRs were generated")
    if len(open_repair_pos) < 5:
        problems.append(f"only {len(open_repair_pos)} open repair POs -- the register would be near-empty")
    if len(flagged_rrs) < 5:
        problems.append(f"only {len(flagged_rrs)} duplicate-flagged RRs -- the guard has nothing to show")
    if not pending:
        problems.append("no PENDING attestations -- the MRP declaration gate cannot be demonstrated")

    if problems:
        raise SystemExit("Initiative 8 dataset check FAILED:\n  - " + "\n  - ".join(problems))

    print(
        f"\nInitiative 8 checks passed:"
        f"\n  repairable materials       {len(repairables):>6}  ({len(repairables) / len(materials) * 100:.1f}% of catalogue)"
        f"\n  repair PRs / POs           {len(repair_prs):>6} / {len(repair_pos)}"
        f"\n  open repair chains (PO)    {len(open_repair_pos):>6}"
        f"\n  duplicate-flagged RRs      {len(flagged_rrs):>6}"
        f"\n  attestations (pending)     {len(attestations):>6}  ({len(pending)} pending)"
    )


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
    args = parser.parse_args()

    settings = get_settings()
    seed = args.seed if args.seed is not None else settings.synthetic_data_seed
    rng = random.Random(seed)
    faker = Faker()
    faker.seed_instance(seed)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    print(f"Generating synthetic Initiative-9 dataset with SEED={seed} ...")
    rows = Rows()

    users = generate_users(rng, faker, rows)
    materials = generate_materials(rng, now_iso, rows)
    suppliers = generate_suppliers(rng, rows)
    users_by_role = pick_users_by_role(users)

    generate_pipeline(rng, now, users, users_by_role, materials, suppliers, rows)
    generate_attestations(rng, now, materials, users_by_role, rows)
    backfill_material_last_purchase(materials, suppliers, rows)

    verify_initiative_8_dataset(materials, rows)

    print("Writing CSV files ...")
    persist(rows, settings.data_dir)

    print("\nDone. Row counts:")
    for name in WRITE_ORDER:
        print(f"  {name:<24} {len(rows.data.get(name, [])):>6}")


if __name__ == "__main__":
    main()
