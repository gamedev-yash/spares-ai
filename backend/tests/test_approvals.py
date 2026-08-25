from app.schemas.procurement import RequestRequisitionCreate, RRLineItemCreate
from app.services.rr_service import create_rr
from tests.conftest import auth_headers, make_material, make_user


def _make_pending_approval(store, requester, material, priority="Normal"):
    payload = RequestRequisitionCreate(
        plant="Gamsberg",
        department="Mechanical Engineering",
        required_date="2026-12-01",
        purpose="Test",
        priority=priority,
        line_items=[RRLineItemCreate(material_id=material["id"], quantity=2)],
    )
    rr = create_rr(store, requester, payload)
    approval = store.approvals.filter(lambda a: a["rr_id"] == rr["id"])[0]
    return approval, rr


def test_approve_success_updates_rr_status(client, store):
    requester = make_user(store, employee_code="EMP032", role="END_USER")
    make_user(store, employee_code="EMP033", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81002")
    approval, rr = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP033")
    resp = client.post(f"/api/approvals/{approval['id']}/approve", json={"comments": "ok"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED"

    assert store.rr.get(rr["id"])["status"] == "MRP_PROCESSING"


def test_double_approve_conflicts(client, store):
    requester = make_user(store, employee_code="EMP034", role="END_USER")
    make_user(store, employee_code="EMP035", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81003")
    approval, _ = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP035")
    first = client.post(f"/api/approvals/{approval['id']}/approve", json={}, headers=headers)
    assert first.status_code == 200
    second = client.post(f"/api/approvals/{approval['id']}/approve", json={}, headers=headers)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


def test_reject_updates_rr_status(client, store):
    requester = make_user(store, employee_code="EMP036", role="END_USER")
    make_user(store, employee_code="EMP037", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81004")
    approval, rr = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP037")
    resp = client.post(f"/api/approvals/{approval['id']}/reject", json={"comments": "no budget"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "REJECTED"
    assert store.rr.get(rr["id"])["status"] == "REJECTED"


def test_escalate_bumps_approval_level(client, store):
    requester = make_user(store, employee_code="EMP038", role="END_USER")
    make_user(store, employee_code="EMP039", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81005")
    approval, _ = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP039")
    resp = client.post(f"/api/approvals/{approval['id']}/escalate", json={}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ESCALATED"
    assert body["approval_level"] == 2


def test_approval_action_creates_audit_log(client, store):
    requester = make_user(store, employee_code="EMP042", role="END_USER")
    make_user(store, employee_code="EMP043", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81007")
    approval, _ = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP043")
    client.post(f"/api/approvals/{approval['id']}/approve", json={}, headers=headers)

    logs = store.audit_logs.filter(lambda a: a["entity_type"] == "APPROVAL" and a["entity_id"] == approval["id"])
    assert any(log["action"] == "APPROVAL_APPROVED" for log in logs)


def test_approval_action_creates_notification(client, store):
    requester = make_user(store, employee_code="EMP044", role="END_USER")
    make_user(store, employee_code="EMP045", role="ENGINEERING_MANAGER")
    material = make_material(store, material_code="500-81008")
    approval, rr = _make_pending_approval(store, requester, material)

    headers = auth_headers(client, "EMP045")
    client.post(f"/api/approvals/{approval['id']}/approve", json={}, headers=headers)

    notifications = store.notifications.filter(lambda n: n["recipient_id"] == requester["id"])
    assert any(n["related_entity_id"] == rr["id"] for n in notifications)
