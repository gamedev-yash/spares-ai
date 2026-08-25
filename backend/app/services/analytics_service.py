"""Cycle-time / bottleneck / open-PR-PO analytics computed from the synthetic Initiative-9
dataset (process_stage_events.csv + rr/pr/po.csv) -- the "live synthetic lane", distinct from
the frozen VZI reference dashboard. No number here is hardcoded; it's all derived from the
actual CSV rows, so regenerating the dataset with a different SEED changes these outputs.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import date, datetime, timezone

from app.services.csv_store import DataStore

OPEN_PR_STATUSES = {"OPEN", "AWAITING_RFQ", "AWAITING_ARIBA", "AWAITING_NFA", "AWAITING_PO"}
OPEN_PO_STATUSES = {"OPEN", "PARTIALLY_DELIVERED"}


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _stage_durations(store: DataStore) -> dict[str, list[float]]:
    out: dict[str, list[float]] = defaultdict(list)
    for event in store.process_stage_events.all():
        if not event.get("completed_at"):
            continue
        started = _parse_dt(event["started_at"])
        completed = _parse_dt(event["completed_at"])
        out[event["stage_code"]].append((completed - started).total_seconds() / 86400)
    return out


def _percentile(data: list[float], p: float) -> float | None:
    if not data:
        return None
    s = sorted(data)
    k = (len(s) - 1) * p
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    return round(s[f] + (s[c] - s[f]) * (k - f), 2)


def get_cycle_time(store: DataStore) -> dict:
    """RR_CREATED -> PO_CREATED elapsed time, per RR that actually reached a PO."""
    rr_starts: dict[int, datetime] = {
        e["entity_id"]: _parse_dt(e["started_at"])
        for e in store.process_stage_events.all()
        if e["entity_type"] == "RR" and e["stage_code"] == "RR_CREATED"
    }
    pr_to_rr = {pr["id"]: pr["rr_id"] for pr in store.pr.all() if pr.get("rr_id") is not None}

    cycle_days: list[float] = []
    trend: dict[str, list[float]] = defaultdict(list)
    for event in store.process_stage_events.all():
        if event["entity_type"] != "PR" or event["stage_code"] != "PO_CREATED" or not event.get("completed_at"):
            continue
        rr_id = pr_to_rr.get(event["entity_id"])
        started_at = rr_starts.get(rr_id) if rr_id is not None else None
        if started_at is None:
            continue
        completed_at = _parse_dt(event["completed_at"])
        days = (completed_at - started_at).total_seconds() / 86400
        cycle_days.append(days)
        trend[completed_at.strftime("%Y-%m")].append(days)

    stage_durations = _stage_durations(store)
    stage_avgs = {stage: round(statistics.mean(durations), 2) for stage, durations in stage_durations.items() if durations}
    bottleneck_stage = max(stage_avgs, key=lambda s: stage_avgs[s]) if stage_avgs else None

    return {
        "sample_size": len(cycle_days),
        "average_days": round(statistics.mean(cycle_days), 2) if cycle_days else None,
        "median_days": _percentile(cycle_days, 0.5),
        "p90_days": _percentile(cycle_days, 0.9),
        "p95_days": _percentile(cycle_days, 0.95),
        "stage_wise_avg_days": stage_avgs,
        "bottleneck_stage": bottleneck_stage,
        "trend": [
            {"month": month, "average_days": round(statistics.mean(days), 2), "count": len(days)}
            for month, days in sorted(trend.items())
        ],
    }


def get_bottlenecks(store: DataStore) -> dict:
    stage_durations = _stage_durations(store)
    grand_total = sum(sum(d) for d in stage_durations.values()) or 1.0

    stages = []
    for stage_code, durations in stage_durations.items():
        if not durations:
            continue
        avg = statistics.mean(durations)
        threshold = avg * 1.5
        delayed = sum(1 for d in durations if d > threshold)
        stages.append(
            {
                "stage_code": stage_code,
                "average_duration_days": round(avg, 2),
                "transaction_count": len(durations),
                "delayed_transaction_count": delayed,
                "delayed_pct": round((delayed / len(durations)) * 100, 1),
                "pct_contribution_to_total_delay": round((sum(durations) / grand_total) * 100, 1),
            }
        )
    stages.sort(key=lambda s: s["pct_contribution_to_total_delay"], reverse=True)
    return {"stages": stages}


def _current_stage_for(store: DataStore, entity_type: str, entity_id: int) -> str | None:
    events = [
        e for e in store.process_stage_events.all()
        if e["entity_type"] == entity_type and e["entity_id"] == entity_id and e["status"] == "IN_PROGRESS"
    ]
    if not events:
        return None
    events.sort(key=lambda e: e["started_at"], reverse=True)
    return events[0]["stage_code"]


def get_open_pr_po(store: DataStore, page: int, page_size: int) -> dict:
    today = date.today()
    users_by_id = {u["id"]: u for u in store.users.all()}

    open_prs = []
    for pr in store.pr.all():
        if pr.get("status") not in OPEN_PR_STATUSES:
            continue
        buyer = users_by_id.get(pr.get("buyer_id"))
        open_prs.append(
            {
                "type": "PR",
                "number": pr["pr_number"],
                "status": pr["status"],
                "current_stage": _current_stage_for(store, "PR", pr["id"]) or pr["status"],
                "owner": buyer["name"] if buyer else None,
                "days_open": (today - _parse_date(pr["creation_date"])).days,
                "value": float(pr["total_value"]),
            }
        )

    open_pos = []
    for po in store.po.all():
        if po.get("status") not in OPEN_PO_STATUSES:
            continue
        buyer = users_by_id.get(po.get("buyer_id"))
        open_pos.append(
            {
                "type": "PO",
                "number": po["po_number"],
                "status": po["status"],
                "current_stage": "PO_CREATED",
                "owner": buyer["name"] if buyer else None,
                "days_open": (today - _parse_date(po["creation_date"])).days,
                "value": float(po["total_value"]),
            }
        )

    combined = sorted(open_prs + open_pos, key=lambda r: r["days_open"], reverse=True)
    total = len(combined)
    start = (page - 1) * page_size
    page_items = combined[start : start + page_size]

    return {
        "items": page_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "open_pr_count": len(open_prs),
        "open_po_count": len(open_pos),
        "open_pr_value": round(sum(r["value"] for r in open_prs), 2),
        "open_po_value": round(sum(r["value"] for r in open_pos), 2),
    }


def get_dashboard_summary(store: DataStore) -> dict:
    cycle_time = get_cycle_time(store)
    bottlenecks = get_bottlenecks(store)
    open_positions = get_open_pr_po(store, page=1, page_size=1)

    today = date.today()
    over_30_count = sum(
        1 for pr in store.pr.all()
        if pr.get("status") in OPEN_PR_STATUSES and (today - _parse_date(pr["creation_date"])).days > 30
    )

    return {
        "open_pr_count": open_positions["open_pr_count"],
        "open_po_count": open_positions["open_po_count"],
        "open_pr_value": open_positions["open_pr_value"],
        "open_po_value": open_positions["open_po_value"],
        "average_cycle_time_days": cycle_time["average_days"],
        "bottleneck_stage": cycle_time["bottleneck_stage"],
        "prs_over_30_days": over_30_count,
        "top_bottleneck_stages": bottlenecks["stages"][:3],
    }
