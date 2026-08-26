"""Initiative 8 -- repairable identification, active repair chain detection, and the
repair-vs-new economic evaluation.

This is the core of the duplicate-spend guard. Three ideas, in order:

1. **Identification.** A material is repairable if its code carries the 80-series
   convention. Nothing is stored -- `csv_store.is_repairable_code` is the single place
   that decision is made, exactly as the real solution keys off the SAP material code.

2. **Active chain detection.** A repair chain is active for a (material, plant) pair when
   an open, undelivered REPAIR requisition or purchase order exists for it. It is derived
   live from the pr/po tables on every lookup rather than cached in a table of its own --
   the real solution reads EBAN/EKKO/EKPO in real time, and a materialised copy could drift
   from the documents it claims to summarise.

3. **Economic evaluation.** Repair cost comes from the actual open repair document wherever
   one exists, falling back to the material's `repair_cost_factor` only when a chain is
   still at requisition stage. Every figure traces to a row in the data; nothing is invented.

The guard this feeds is ADVISORY -- see `rr_service.create_rr`. It flags and warns; it never
blocks a duplicate. Only the condition-to-repair attestation is a hard gate.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from app.services.csv_store import (
    ATTESTATION_STATUS_PENDING,
    DOC_TYPE_REPAIR,
    DataStore,
    Row,
    is_repairable_code,
)

# A repair requisition that has not yet become a PO is still an active chain.
OPEN_REPAIR_PR_STATUSES = {"OPEN", "AWAITING_RFQ", "AWAITING_ARIBA", "AWAITING_NFA", "AWAITING_PO"}
OPEN_REPAIR_PO_STATUSES = {"OPEN", "PARTIALLY_DELIVERED"}
# Line-level states that mean the unit has come back from the vendor.
RECEIVED_LINE_STATUSES = {"DELIVERED", "CLOSED", "RECEIVED"}


def is_repair_document(row: Row | None) -> bool:
    return bool(row) and row.get("doc_type") == DOC_TYPE_REPAIR


def is_new_buy_document(row: Row | None) -> bool:
    """Anything not explicitly a repair document is new-buy. Treating a missing doc_type as
    new-buy keeps every pre-existing analytic behaving exactly as it did before Initiative 8
    added the column."""
    return not is_repair_document(row)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def material_is_repairable(store: DataStore, material_id: int) -> bool:
    material = store.materials.get(material_id)
    return is_repairable_code(material.get("material_code")) if material else False


def repairable_material_ids(store: DataStore) -> set[int]:
    return {m["id"] for m in store.materials.all() if is_repairable_code(m.get("material_code"))}


def _outstanding_quantity(lines: list[Row]) -> float:
    """Open PO quantity less what has been received -- the platform-side equivalent of
    'open PO quantity less MSEG receipts' in the Initiative 8 register spec."""
    return sum(
        float(line.get("quantity") or 0)
        for line in lines
        if line.get("status") not in RECEIVED_LINE_STATUSES
    )


def collect_open_chains(store: DataStore) -> list[dict]:
    """Every repair chain that is open right now, one entry per (repair document, material).

    Chains backed by a PO are reported through the PO -- it carries the vendor and the
    expected return date. A repair PR that has not yet been converted is reported on its own.
    """
    today = _today()
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    suppliers_by_id = {s["id"]: s for s in store.suppliers.all()}
    pr_by_id = {p["id"]: p for p in store.pr.all()}

    po_lines_by_po: dict[int, list[Row]] = defaultdict(list)
    for line in store.po_line_items.all():
        po_lines_by_po[line["po_id"]].append(line)

    pr_lines_by_pr: dict[int, list[Row]] = defaultdict(list)
    for line in store.pr_line_items.all():
        pr_lines_by_pr[line["pr_id"]].append(line)

    chains: list[dict] = []
    covered_pr_ids: set[int] = set()

    # --- chains represented by an open repair PO ---
    for po in store.po.all():
        if not is_repair_document(po) or po.get("status") not in OPEN_REPAIR_PO_STATUSES:
            continue
        lines = po_lines_by_po.get(po["id"], [])
        outstanding = _outstanding_quantity(lines)
        if outstanding <= 0:
            continue  # everything already came back; the chain is closed in practice

        pr = pr_by_id.get(po.get("pr_id"))
        if pr is not None:
            covered_pr_ids.add(pr["id"])
        supplier = suppliers_by_id.get(po.get("supplier_id"))
        opened = _parse_date(po.get("creation_date"))
        expected = _parse_date(po.get("expected_delivery"))

        by_material: dict[int, float] = defaultdict(float)
        for line in lines:
            if line.get("status") not in RECEIVED_LINE_STATUSES:
                by_material[line["material_id"]] += float(line.get("quantity") or 0)

        for material_id, qty in by_material.items():
            material = materials_by_id.get(material_id)
            if material is None:
                continue
            chains.append(
                {
                    "material_id": material_id,
                    "material_code": material.get("material_code"),
                    "material_description": material.get("description"),
                    "material_group": material.get("material_group"),
                    "plant": po.get("plant") or (pr.get("plant") if pr else material.get("plant")),
                    "repair_pr_number": pr.get("pr_number") if pr else None,
                    "repair_pr_id": pr.get("id") if pr else None,
                    "repair_po_number": po.get("po_number"),
                    "repair_po_id": po["id"],
                    "supplier_id": po.get("supplier_id"),
                    "vendor": supplier.get("supplier_name") if supplier else None,
                    "quantity_under_repair": qty,
                    "repair_value": float(po.get("total_value") or 0),
                    "opened_at": opened.isoformat() if opened else None,
                    "expected_return": expected.isoformat() if expected else None,
                    "days_open": (today - opened).days if opened else None,
                    "days_overdue": (today - expected).days if expected and expected < today else 0,
                    "overdue": bool(expected and expected < today),
                    "stage": "AT_VENDOR",
                }
            )

    # --- chains still at repair-requisition stage, with no PO yet ---
    for pr in store.pr.all():
        if not is_repair_document(pr) or pr["id"] in covered_pr_ids:
            continue
        if pr.get("status") not in OPEN_REPAIR_PR_STATUSES:
            continue
        opened = _parse_date(pr.get("creation_date"))
        expected = _parse_date(pr.get("required_date"))
        for line in pr_lines_by_pr.get(pr["id"], []):
            material = materials_by_id.get(line["material_id"])
            if material is None:
                continue
            chains.append(
                {
                    "material_id": line["material_id"],
                    "material_code": material.get("material_code"),
                    "material_description": material.get("description"),
                    "material_group": material.get("material_group"),
                    "plant": pr.get("plant") or material.get("plant"),
                    "repair_pr_number": pr.get("pr_number"),
                    "repair_pr_id": pr["id"],
                    "repair_po_number": None,
                    "repair_po_id": None,
                    "supplier_id": None,
                    "vendor": None,
                    "quantity_under_repair": float(line.get("quantity") or 0),
                    "repair_value": float(pr.get("total_value") or 0),
                    "opened_at": opened.isoformat() if opened else None,
                    "expected_return": expected.isoformat() if expected else None,
                    "days_open": (today - opened).days if opened else None,
                    "days_overdue": (today - expected).days if expected and expected < today else 0,
                    "overdue": bool(expected and expected < today),
                    "stage": "AWAITING_VENDOR_DISPATCH",
                }
            )

    chains.sort(key=lambda c: (c["days_open"] is None, -(c["days_open"] or 0)))
    return chains


def active_chains_for(store: DataStore, material_id: int, plant: str | None = None) -> list[dict]:
    """The duplicate-guard join: open repair chains for this material at this plant.

    Plant is part of the key because a unit under repair for Gamsberg does nothing for a
    shortage at BMM -- matching on material alone would raise false alarms across sites.
    """
    return [
        chain for chain in collect_open_chains(store)
        if chain["material_id"] == material_id and (plant is None or chain["plant"] == plant)
    ]


def quantity_under_repair(store: DataStore, material_id: int, plant: str | None = None) -> float:
    return sum(c["quantity_under_repair"] for c in active_chains_for(store, material_id, plant))


def check_duplicate(store: DataStore, material_id: int, plant: str | None = None) -> dict:
    """What the guard reports at the point a new-buy requisition is raised.

    Returns a plain dict rather than raising, because a detected duplicate is never an
    error -- it is information the requisitioner is free to act on or override.
    """
    material = store.materials.get(material_id)
    if material is None:
        return {"material_id": material_id, "is_repairable": False, "has_active_chain": False, "chains": []}

    repairable = is_repairable_code(material.get("material_code"))
    chains = active_chains_for(store, material_id, plant) if repairable else []

    return {
        "material_id": material_id,
        "material_code": material.get("material_code"),
        "material_description": material.get("description"),
        "plant": plant,
        "is_repairable": repairable,
        "has_active_chain": bool(chains),
        "total_quantity_under_repair": sum(c["quantity_under_repair"] for c in chains),
        "earliest_expected_return": min(
            (c["expected_return"] for c in chains if c["expected_return"]), default=None
        ),
        "chains": chains,
    }


def economic_evaluation(store: DataStore, material_id: int, plant: str | None = None) -> dict | None:
    """Repair-in-flight versus buying new: cost, lead time, and availability date.

    Returns None when there is nothing to compare against -- no active chain means there is
    no decision to inform.
    """
    material = store.materials.get(material_id)
    if material is None:
        return None

    chains = active_chains_for(store, material_id, plant)
    if not chains:
        return None

    # Compare against the chain that actually competes with buying new: the soonest
    # *credible* return. An overdue chain has already missed its date, so it is only used
    # when nothing better exists -- picking it first would present a late repair as the
    # fastest option, which is exactly backwards.
    on_time = [c for c in chains if c["expected_return"] and not c["overdue"]]
    late = [c for c in chains if c["expected_return"] and c["overdue"]]
    if on_time:
        chain = min(on_time, key=lambda c: c["expected_return"])
    elif late:
        chain = min(late, key=lambda c: c["expected_return"])
    else:
        chain = chains[0]

    new_unit_cost = float(material.get("last_po_price") or 0)
    new_lead_time = int(material.get("lead_time_days") or 0)
    qty = chain["quantity_under_repair"] or 1

    if chain["repair_po_id"] is not None and chain["repair_value"]:
        # The repair is already priced -- use what it actually costs.
        repair_total = float(chain["repair_value"])
        basis = "OPEN_REPAIR_PO"
    elif chain["repair_pr_id"] is not None and chain["repair_value"]:
        repair_total = float(chain["repair_value"])
        basis = "OPEN_REPAIR_PR"
    else:
        factor = float(material.get("repair_cost_factor") or 0.35)
        repair_total = round(new_unit_cost * factor * qty, 2)
        basis = "ESTIMATED_FROM_MATERIAL_FACTOR"

    new_total = round(new_unit_cost * qty, 2)
    saving = round(new_total - repair_total, 2)

    expected_return = _parse_date(chain["expected_return"])
    today = _today()
    days_until_return = (expected_return - today).days if expected_return else None

    return {
        "material_id": material_id,
        "material_code": material.get("material_code"),
        "material_description": material.get("description"),
        "plant": chain["plant"],
        "quantity": qty,
        "repair_total_cost": round(repair_total, 2),
        "repair_cost_basis": basis,
        "repair_reference": chain["repair_po_number"] or chain["repair_pr_number"],
        "repair_vendor": chain["vendor"],
        "repair_expected_return": chain["expected_return"],
        "repair_days_until_return": days_until_return,
        "repair_is_overdue": chain["overdue"],
        "new_total_cost": new_total,
        "new_unit_cost": round(new_unit_cost, 2),
        "new_lead_time_days": new_lead_time,
        "saving_if_repair_used": saving,
        "saving_pct": round((saving / new_total) * 100, 1) if new_total else None,
        # Whichever arrives first, on the numbers alone. An overdue chain never counts as
        # "sooner" -- its date has already passed and the unit still is not back, so there
        # is no date left to rely on. The decision stays with the human; this only makes
        # the trade-off visible (Initiative 8 SS3.3).
        "repair_arrives_sooner": (
            not chain["overdue"]
            and days_until_return is not None
            and days_until_return <= new_lead_time
        ),
    }


def attestation_summary(store: DataStore) -> dict[tuple[int, str], dict]:
    """Declaration status per (material, plant) -- the register's seventh field."""
    summary: dict[tuple[int, str], dict] = defaultdict(lambda: {"pending": 0, "complete": 0})
    for row in store.attestations.all():
        key = (row.get("material_id"), row.get("plant"))
        if row.get("status") == ATTESTATION_STATUS_PENDING:
            summary[key]["pending"] += 1
        else:
            summary[key]["complete"] += 1
    return summary
