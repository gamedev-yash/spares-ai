"""Initiative 8 SS3.4 -- the repair status register, integrated with inventory.

One row per open repair chain, carrying the seven fields the specification names:

    Material (80-series) + description   <- materials
    Plant and stock on hand              <- materials
    Reorder point context                <- materials
    Open repair PR / PO references       <- pr / po (doc_type = REPAIR)
    Quantity under repair at vendor      <- open PO quantity less receipts
    Expected return date and days open   <- po delivery / document dates
    Declaration status                   <- attestations

The point of putting stock on hand next to quantity under repair is that it is the one
view where the refurbishment loop becomes visible to whoever is about to reorder. The
`reorder_triggered` flag is the sharp end: stock at or below the reorder point *while a
unit is already out for repair* is precisely the condition that produces a duplicate buy.

Read-only. Nothing here writes, and the register is derived on every request rather than
materialised -- see repair_service for why.
"""

from __future__ import annotations

from app.services import repair_service
from app.services.csv_store import DataStore


def _summary(rows: list[dict]) -> dict:
    # Declaration counts are held per (material, plant), and one material can appear on more
    # than one chain row -- so dedupe before summing, or the same pending declaration is
    # counted once per chain.
    pending_by_pair = {
        (r["material_id"], r["plant"]): r["declarations_pending"] for r in rows
    }
    return {
        "open_chain_count": len(rows),
        "total_quantity_under_repair": round(sum(r["quantity_under_repair"] for r in rows), 2),
        "total_value_under_repair": round(sum(r["repair_value"] for r in rows), 2),
        "overdue_count": sum(1 for r in rows if r["overdue"]),
        "reorder_triggered_count": sum(1 for r in rows if r["reorder_triggered"]),
        "duplicate_risk_count": sum(1 for r in rows if r["reorder_triggered"]),
        "pending_declaration_count": sum(pending_by_pair.values()),
        "average_days_open": (
            round(sum(r["days_open"] or 0 for r in rows) / len(rows), 1) if rows else None
        ),
    }


def get_register(
    store: DataStore,
    plant: str | None = None,
    status: str | None = None,
    material_group: str | None = None,
    search: str | None = None,
) -> dict:
    """Build the register. `status` accepts OVERDUE / IN_FLIGHT / REORDER_TRIGGERED."""
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    declarations = repair_service.attestation_summary(store)

    rows: list[dict] = []
    for chain in repair_service.collect_open_chains(store):
        material = materials_by_id.get(chain["material_id"])
        if material is None:
            continue

        stock_on_hand = int(material.get("stock_level") or 0)
        reorder_point = material.get("reorder_point")
        reorder_point = int(reorder_point) if reorder_point is not None else None
        reorder_triggered = reorder_point is not None and stock_on_hand <= reorder_point

        decl = declarations.get((chain["material_id"], chain["plant"]), {"pending": 0, "complete": 0})

        rows.append(
            {
                **chain,
                "stock_on_hand": stock_on_hand,
                "unit_of_measure": material.get("unit_of_measure"),
                "reorder_point": reorder_point,
                "reorder_triggered": reorder_triggered,
                "criticality": material.get("criticality"),
                "new_unit_cost": float(material.get("last_po_price") or 0),
                "new_lead_time_days": int(material.get("lead_time_days") or 0),
                "declarations_pending": decl["pending"],
                "declarations_complete": decl["complete"],
                # Stock has fallen to the reorder trigger while the unit is still at the
                # vendor -- the exact set-up for a duplicate requisition.
                "duplicate_risk": reorder_triggered,
            }
        )

    if plant:
        rows = [r for r in rows if r["plant"] == plant]
    if material_group:
        rows = [r for r in rows if r["material_group"] == material_group]
    if status == "OVERDUE":
        rows = [r for r in rows if r["overdue"]]
    elif status == "IN_FLIGHT":
        rows = [r for r in rows if not r["overdue"]]
    elif status == "REORDER_TRIGGERED":
        rows = [r for r in rows if r["reorder_triggered"]]
    if search:
        needle = search.lower()
        rows = [
            r for r in rows
            if needle in (r["material_code"] or "").lower()
            or needle in (r["material_description"] or "").lower()
            or needle in (r["vendor"] or "").lower()
            or needle in (r["repair_po_number"] or "").lower()
            or needle in (r["repair_pr_number"] or "").lower()
        ]

    return {"items": rows, "summary": _summary(rows), "total": len(rows)}


def get_plants(store: DataStore) -> list[str]:
    return sorted({c["plant"] for c in repair_service.collect_open_chains(store) if c["plant"]})
