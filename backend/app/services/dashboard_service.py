"""Computes the VZI "Open PR & PO position" dashboard and the Situation Analysis
root-cause/fishbone view **live, from the generated synthetic dataset** -- rr/pr/po/
rr_line_items/pr_line_items/process_stage_events/approvals/users/materials.csv.

Earlier builds of this app served these two views from fixed, hand-transcribed reference
numbers (a real VZI slide deck). Per instruction, nothing on any page is hardcoded anymore:
these are now just two more slices over the exact same procurement lifecycle data that
powers /api/analytics/*. Re-running the generator with a different seed changes these
numbers too, same as everything else.

Both entry points return plain dicts shaped exactly like the old fixed-reference dicts did,
so the route layer (api/routes/vzi.py, api/routes/situation_analysis.py) needed no changes
beyond swapping their data source.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from app.services.csv_store import DataStore, Row

AGING_BUCKETS = ["0-7 days", "7-15 days", "15-30 days", "30-60 days", "60-90 days", "90-120 days", "More than 120 days"]

OPEN_RR_STATUSES = {"WAITING_DOA", "MRP_PROCESSING", "ESCALATED"}
OPEN_PR_STATUSES = {"OPEN", "AWAITING_RFQ", "AWAITING_ARIBA", "AWAITING_NFA", "AWAITING_PO"}
OPEN_PO_STATUSES = {"OPEN", "PARTIALLY_DELIVERED"}

STAGE_ROOT_CAUSE = {
    "DOA": ("User Delay - Approval", ["Awaiting engineering/commercial sign-off", "Approver has a backlog of pending items"]),
    "MRP": ("System Delay - MRP Processing", ["MRP run backlog", "Manual planner review required"]),
    "RFQ": ("Vendor Delay - RFQ Response", ["Supplier response delays", "Insufficient supplier participation"]),
    "ARIBA": ("Vendor Delay - Ariba Participation", ["Low supplier turnout in sourcing event", "Event extended for more bids"]),
    "NFA": ("Approval Delay - NFA", ["Awaiting commercial manager sign-off", "High-value approval requires additional review"]),
}
NO_STAGE_ROOT_CAUSE = ("Buyer Delay - PO Creation", ["Buyer workload backlog", "Final supplier confirmation pending"])
ESCALATED_ROOT_CAUSE = ("Escalated - Senior Review Pending", ["Escalated past standard approval level", "Awaiting senior management decision"])


def _aging_bucket(days: int) -> str:
    if days <= 7:
        return AGING_BUCKETS[0]
    if days <= 15:
        return AGING_BUCKETS[1]
    if days <= 30:
        return AGING_BUCKETS[2]
    if days <= 60:
        return AGING_BUCKETS[3]
    if days <= 90:
        return AGING_BUCKETS[4]
    if days <= 120:
        return AGING_BUCKETS[5]
    return AGING_BUCKETS[6]


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _line_item_price(line: Row) -> float:
    return float(line.get("estimated_unit_price") if "estimated_unit_price" in line else line.get("unit_price") or 0)


def _dominant_group(line_items: list[Row], materials_by_id: dict[int, Row]) -> str:
    best_group = "Other"
    best_value = -1.0
    for li in line_items:
        material = materials_by_id.get(li.get("material_id"))
        if material is None:
            continue
        value = float(li.get("quantity") or 0) * _line_item_price(li)
        if value > best_value:
            best_value = value
            best_group = material["material_group"]
    return best_group


def _type_for_group(group: str) -> str:
    return "Service" if group == "Services" else "Material"


class _OpenItem:
    __slots__ = ("number", "unit", "area", "trigger_type", "type", "category", "value", "days_open", "urgency", "root_cause", "sub_causes", "primary_cause_detail", "stuck_with_person", "stuck_with_role", "stuck_since")

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _collect_open_items(store: DataStore, today: date) -> list[_OpenItem]:
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    users_by_id = {u["id"]: u for u in store.users.all()}
    rr_by_id = {r["id"]: r for r in store.rr.all()}

    rr_lines_by_rr: dict[int, list[Row]] = defaultdict(list)
    for li in store.rr_line_items.all():
        rr_lines_by_rr[li["rr_id"]].append(li)

    pr_lines_by_pr: dict[int, list[Row]] = defaultdict(list)
    for li in store.pr_line_items.all():
        pr_lines_by_pr[li["pr_id"]].append(li)

    approvals_by_rr: dict[int, list[Row]] = defaultdict(list)
    for a in store.approvals.all():
        if a.get("rr_id") is not None:
            approvals_by_rr[a["rr_id"]].append(a)

    stage_events_by_pr: dict[int, list[Row]] = defaultdict(list)
    for e in store.process_stage_events.all():
        if e["entity_type"] == "PR":
            stage_events_by_pr[e["entity_id"]].append(e)

    def owner_name_role(owner_id: int | None) -> tuple[str, str]:
        user = users_by_id.get(owner_id) if owner_id is not None else None
        if user is None:
            return "Procurement Team", "PROCUREMENT"
        return user["name"], user["role"]

    items: list[_OpenItem] = []

    # --- RR-level open items (not yet a PR) ---
    for rr in store.rr.all():
        if rr["status"] not in OPEN_RR_STATUSES:
            continue
        group = _dominant_group(rr_lines_by_rr.get(rr["id"], []), materials_by_id)
        stuck_since = _parse_date(rr["creation_date"])

        if rr["status"] == "WAITING_DOA":
            pending = next((a for a in approvals_by_rr.get(rr["id"], []) if a["status"] == "PENDING"), None)
            root_cause, sub_causes = STAGE_ROOT_CAUSE["DOA"]
            if pending and pending.get("approver_id") is not None:
                person, role = owner_name_role(pending["approver_id"])
            else:
                person, role = "Unassigned", (pending["approver_role"] if pending else "ENGINEERING_MANAGER")
            stuck_since = _parse_date(pending["submitted_at"][:10]) if pending else stuck_since
        elif rr["status"] == "ESCALATED":
            escalated = next((a for a in approvals_by_rr.get(rr["id"], []) if a["status"] == "ESCALATED"), None)
            root_cause, sub_causes = ESCALATED_ROOT_CAUSE
            if escalated and escalated.get("approver_id") is not None:
                person, role = owner_name_role(escalated["approver_id"])
            else:
                person, role = "Unassigned", (escalated["approver_role"] if escalated else "COMMERCIAL_MANAGER")
            if escalated and escalated.get("action_at"):
                stuck_since = min(_parse_date(escalated["action_at"][:10]), today)
        else:  # MRP_PROCESSING
            root_cause, sub_causes = STAGE_ROOT_CAUSE["MRP"]
            person, role = "Procurement Team", "PROCUREMENT"

        days_open = max((today - _parse_date(rr["creation_date"])).days, 0)
        items.append(
            _OpenItem(
                number=rr["rr_number"], unit=rr["plant"], area=rr.get("area") or "Other",
                trigger_type=rr.get("trigger_type") or "OAR_MANUAL", type=_type_for_group(group), category=group,
                value=float(rr["total_estimated_value"]), days_open=days_open, urgency=rr["priority"],
                root_cause=root_cause, sub_causes=sub_causes,
                primary_cause_detail=f"{root_cause} -- stuck {max((today - stuck_since).days, 0)} day(s), owned by {role}.",
                stuck_with_person=person, stuck_with_role=role, stuck_since=stuck_since,
            )
        )

    # --- PR-level open items ---
    for pr in store.pr.all():
        if pr["status"] not in OPEN_PR_STATUSES:
            continue
        rr = rr_by_id.get(pr.get("rr_id"))
        group = _dominant_group(pr_lines_by_pr.get(pr["id"], []), materials_by_id)

        in_progress = [e for e in stage_events_by_pr.get(pr["id"], []) if e["status"] == "IN_PROGRESS"]
        in_progress.sort(key=lambda e: e["started_at"], reverse=True)
        current = in_progress[0] if in_progress else None

        if current is not None and current["stage_code"] in STAGE_ROOT_CAUSE:
            root_cause, sub_causes = STAGE_ROOT_CAUSE[current["stage_code"]]
            person, role = owner_name_role(current.get("owner_id"))
            stuck_since = _parse_date(current["started_at"][:10])
        else:
            root_cause, sub_causes = NO_STAGE_ROOT_CAUSE
            person, role = owner_name_role(pr.get("buyer_id"))
            stuck_since = _parse_date(pr["creation_date"])

        days_open = max((today - _parse_date(pr["creation_date"])).days, 0)
        items.append(
            _OpenItem(
                number=pr["pr_number"], unit=pr["plant"], area=(rr.get("area") if rr else None) or "Other",
                trigger_type=(rr.get("trigger_type") if rr else None) or "OAR_MANUAL",
                type=_type_for_group(group), category=group, value=float(pr["total_value"]), days_open=days_open,
                urgency=(rr.get("priority") if rr else None) or "Normal",
                root_cause=root_cause, sub_causes=sub_causes,
                primary_cause_detail=f"{root_cause} -- stuck {max((today - stuck_since).days, 0)} day(s), owned by {role}.",
                stuck_with_person=person, stuck_with_role=role, stuck_since=stuck_since,
            )
        )

    return items


def _open_pos(store: DataStore, today: date) -> list[dict]:
    materials_by_id = {m["id"]: m for m in store.materials.all()}
    pr_by_id = {p["id"]: p for p in store.pr.all()}
    rr_by_id = {r["id"]: r for r in store.rr.all()}
    po_lines_by_po: dict[int, list[Row]] = defaultdict(list)
    for li in store.po_line_items.all():
        po_lines_by_po[li["po_id"]].append(li)

    out = []
    for po in store.po.all():
        if po["status"] not in OPEN_PO_STATUSES:
            continue
        pr = pr_by_id.get(po.get("pr_id"))
        rr = rr_by_id.get(pr.get("rr_id")) if pr else None
        group = _dominant_group(po_lines_by_po.get(po["id"], []), materials_by_id)
        out.append(
            {
                "unit": po["plant"] if "plant" in po else (pr["plant"] if pr else "Gamsberg"),
                "area": (rr.get("area") if rr else None) or "Other",
                "type": _type_for_group(group),
                "value": float(po["total_value"]),
            }
        )
    return out


def get_vzi_dashboard(store: DataStore) -> dict:
    """Returns the same dict shape the old fixed vzi_reference_data.py produced, computed
    live from rr/pr/po/materials/users.csv instead."""
    today = datetime.now(timezone.utc).date()
    open_items = _collect_open_items(store, today)
    open_pos = _open_pos(store, today)

    pr_summary: dict[str, dict[str, int]] = defaultdict(lambda: {"material": 0, "service": 0})
    aging_counts: dict[str, int] = defaultdict(int)
    oar_vb: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: {"oar": 0, "vb": 0})
    categories: dict[tuple[str, str, str], int] = defaultdict(int)

    for item in open_items:
        pr_summary[item.unit]["material" if item.type == "Material" else "service"] += 1
        aging_counts[_aging_bucket(item.days_open)] += 1
        if item.type == "Material":
            key = "oar" if item.trigger_type == "OAR_MANUAL" else "vb"
            oar_vb[(item.unit, item.area)][key] += 1
        categories[(item.unit, item.area, item.category)] += 1

    po_summary: dict[str, dict[str, int]] = defaultdict(lambda: {"material": 0, "service": 0})
    po_detail: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: {"matCount": 0, "matValue": 0.0, "svcCount": 0, "svcValue": 0.0})
    for po in open_pos:
        po_summary[po["unit"]]["material" if po["type"] == "Material" else "service"] += 1
        d = po_detail[(po["unit"], po["area"])]
        value_millions = po["value"] / 1_000_000  # the VZI dashboard's money fields are expressed in ZAR millions
        if po["type"] == "Material":
            d["matCount"] += 1
            d["matValue"] += value_millions
        else:
            d["svcCount"] += 1
            d["svcValue"] += value_millions

    units = sorted(pr_summary.keys() | po_summary.keys()) or ["Gamsberg", "BMM"]

    aging_total = len(open_items)
    prs_over_30 = sum(c for bucket, c in aging_counts.items() if bucket not in ("0-7 days", "7-15 days", "15-30 days"))
    total_po_material_value = sum(d["matValue"] for d in po_detail.values())
    total_po_service_value = sum(d["svcValue"] for d in po_detail.values())

    slide_notes = [
        f"{aging_total} open requisitions tracked across {len(units)} unit(s); "
        f"{sum(v['material'] for v in pr_summary.values())} material, {sum(v['service'] for v in pr_summary.values())} service.",
        f"{sum(oar_vb_entry['oar'] for oar_vb_entry in oar_vb.values())} material items trace to a manually-raised (OAR) requisition; "
        f"{sum(oar_vb_entry['vb'] for oar_vb_entry in oar_vb.values())} were auto-triggered by min/max stock levels.",
        f"{len(open_pos)} open POs tracked: {sum(v['material'] for v in po_summary.values())} material, {sum(v['service'] for v in po_summary.values())} service.",
    ]
    derived_notes = [
        f"Requisitions older than 30 days: {prs_over_30} of {aging_total} ({round(prs_over_30/aging_total*100, 1) if aging_total else 0.0}%).",
        f"Service POs carry {round(total_po_service_value/(total_po_material_value+total_po_service_value)*100, 1) if (total_po_material_value+total_po_service_value) else 0.0}% of open PO value.",
    ]

    care_material = sum(1 for i in open_items if i.type == "Material" and i.area == "Mining")
    care_service = sum(1 for po in open_pos if po["type"] == "Service" and po["area"] == "Mining")

    return {
        "pr_summary": [{"unit": u, "material": pr_summary[u]["material"], "service": pr_summary[u]["service"]} for u in units],
        "po_summary": [{"unit": u, "material": po_summary[u]["material"], "service": po_summary[u]["service"]} for u in units],
        "aging": [{"bucket": b, "count": aging_counts.get(b, 0), "sequence_order": i} for i, b in enumerate(AGING_BUCKETS)],
        "oar_vb": [{"unit": u, "area": a, "oar": v["oar"], "vb": v["vb"]} for (u, a), v in sorted(oar_vb.items())],
        "categories": [{"unit": u, "area": a, "category": c, "count": n} for (u, a, c), n in sorted(categories.items(), key=lambda kv: -kv[1])],
        "po_detail": [
            {"unit": u, "area": a, "matCount": d["matCount"], "matValue": round(d["matValue"], 2), "svcCount": d["svcCount"], "svcValue": round(d["svcValue"], 2)}
            for (u, a), d in sorted(po_detail.items())
        ],
        "slide_notes": slide_notes,
        "derived_notes": derived_notes,
        "care_maintenance": {"material": care_material, "service": care_service, "total": care_material + care_service},
        "flags": [],
    }


def get_situation_analysis(store: DataStore) -> dict:
    """Returns the same {aging, po_detail, root_cause, trend, drilldown} shape the old
    fixed situation_analysis.csv produced, computed live from the open RR/PR backlog."""
    today = datetime.now(timezone.utc).date()
    open_items = _collect_open_items(store, today)
    open_pos = _open_pos(store, today)

    aging_counts: dict[str, int] = defaultdict(int)
    for item in open_items:
        aging_counts[_aging_bucket(item.days_open)] += 1
    aging = [{"bucket": b, "count": aging_counts.get(b, 0), "sequence_order": i} for i, b in enumerate(AGING_BUCKETS)]

    po_detail_agg: dict[tuple[str, str, str], dict] = defaultdict(lambda: {"value_zar": 0.0, "count": 0})
    for po in open_pos:
        key = (po["unit"], po["area"], po["type"])
        po_detail_agg[key]["value_zar"] += po["value"]
        po_detail_agg[key]["count"] += 1
    po_detail = [
        {"unit": u, "area": a, "type": t, "value_zar": round(d["value_zar"], 2), "count": d["count"]}
        for (u, a, t), d in po_detail_agg.items()
    ]

    root_cause_days: dict[str, float] = defaultdict(float)
    root_cause_subcauses: dict[str, list[str]] = {}
    trend_days: dict[tuple[str, str], float] = defaultdict(float)
    drilldown = []

    for item in open_items:
        root_cause_days[item.root_cause] += item.days_open
        root_cause_subcauses.setdefault(item.root_cause, item.sub_causes)
        month_key = item.stuck_since.strftime("%Y-%m")
        trend_days[(item.root_cause, month_key)] += item.days_open
        drilldown.append(
            {
                "pr_po_number": item.number, "unit": item.unit, "area": item.area, "type": item.type,
                "category": item.category, "value_zar": round(item.value, 2), "aging_bucket": _aging_bucket(item.days_open),
                "root_cause_category": item.root_cause, "primary_cause_detail": item.primary_cause_detail,
                "stuck_with_person": item.stuck_with_person, "stuck_with_role": item.stuck_with_role,
                "urgency": item.urgency, "session_id": None,
            }
        )

    root_cause = [
        {"root_cause_category": cat, "sub_causes": root_cause_subcauses.get(cat, []), "badge": None, "days_lost": round(days, 1)}
        for cat, days in sorted(root_cause_days.items(), key=lambda kv: kv[1], reverse=True)
    ]
    if root_cause:
        root_cause[0]["badge"] = "Top delay driver"

    trend = [
        {"root_cause_category": cat, "month": month, "days_lost": round(days, 1)}
        for (cat, month), days in sorted(trend_days.items(), key=lambda kv: kv[0][1])
    ]

    return {"aging": aging, "po_detail": po_detail, "root_cause": root_cause, "trend": trend, "drilldown": drilldown}
