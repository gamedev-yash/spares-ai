from datetime import datetime, timezone

from app.services import analytics_service
from tests.conftest import make_user


def _utc(y, m, d) -> str:
    return datetime(y, m, d, tzinfo=timezone.utc).isoformat()


def test_cycle_time_exact_calculation(store):
    """RR created Jan 1, PO created Jan 10 -> cycle time is exactly 9 days."""
    requester = make_user(store, employee_code="EMP050", role="END_USER")

    rr = store.rr.insert(
        {
            "id": store.rr.next_id(), "rr_number": "RR-999001", "requester_id": requester["id"], "plant": "Gamsberg",
            "department": "Procurement", "creation_date": "2026-01-01", "required_date": "2026-01-20", "purpose": "test",
            "status": "COMPLETED", "priority": "Normal", "total_estimated_value": 1000, "source_system": "test",
            "created_at": _utc(2026, 1, 1), "updated_at": _utc(2026, 1, 1),
        }
    )
    pr = store.pr.insert(
        {
            "id": store.pr.next_id(), "pr_number": "PR-999001", "rr_id": rr["id"], "creation_date": "2026-01-02",
            "required_date": "2026-01-20", "status": "PO_CREATED", "buyer_id": None, "plant": "Gamsberg",
            "total_value": 1000, "source_system": "test",
        }
    )
    store.process_stage_events.insert(
        {
            "id": store.process_stage_events.next_id(), "entity_type": "RR", "entity_id": rr["id"], "stage_code": "RR_CREATED",
            "stage_name": "RR Created", "started_at": _utc(2026, 1, 1), "completed_at": _utc(2026, 1, 1), "status": "COMPLETED",
            "owner_id": None, "source_system": "test",
        }
    )
    store.process_stage_events.insert(
        {
            "id": store.process_stage_events.next_id(), "entity_type": "PR", "entity_id": pr["id"], "stage_code": "PO_CREATED",
            "stage_name": "PO Created", "started_at": _utc(2026, 1, 10), "completed_at": _utc(2026, 1, 10), "status": "COMPLETED",
            "owner_id": None, "source_system": "test",
        }
    )

    result = analytics_service.get_cycle_time(store)
    assert result["sample_size"] == 1
    assert result["average_days"] == 9.0
    assert result["median_days"] == 9.0


def test_cycle_time_ignores_rr_without_po(store):
    requester = make_user(store, employee_code="EMP051", role="END_USER")
    rr = store.rr.insert(
        {
            "id": store.rr.next_id(), "rr_number": "RR-999002", "requester_id": requester["id"], "plant": "Gamsberg",
            "department": "Procurement", "creation_date": "2026-01-01", "required_date": "2026-01-20", "purpose": "test",
            "status": "WAITING_DOA", "priority": "Normal", "total_estimated_value": 0, "source_system": "test",
            "created_at": _utc(2026, 1, 1), "updated_at": _utc(2026, 1, 1),
        }
    )
    store.process_stage_events.insert(
        {
            "id": store.process_stage_events.next_id(), "entity_type": "RR", "entity_id": rr["id"], "stage_code": "RR_CREATED",
            "stage_name": "RR Created", "started_at": _utc(2026, 1, 1), "completed_at": _utc(2026, 1, 1), "status": "COMPLETED",
            "owner_id": None, "source_system": "test",
        }
    )

    result = analytics_service.get_cycle_time(store)
    assert result["sample_size"] == 0
    assert result["average_days"] is None


def test_dashboard_summary_endpoint(client):
    resp = client.get("/api/analytics/dashboard-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert "open_pr_count" in body
    assert "open_po_count" in body
