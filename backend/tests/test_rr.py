from tests.conftest import auth_headers, make_material, make_user


def _rr_payload(material_id: int, **overrides):
    payload = {
        "plant": "Gamsberg",
        "department": "Mechanical Engineering",
        "required_date": "2026-12-01",
        "purpose": "Test requisition",
        "priority": "Normal",
        "line_items": [{"material_id": material_id, "quantity": 3}],
    }
    payload.update(overrides)
    return payload


def test_create_rr_success(client, store):
    make_user(store, employee_code="EMP020", role="END_USER")
    material = make_material(store, material_code="500-79001", price=500.0)
    headers = auth_headers(client, "EMP020")

    resp = client.post("/api/rr", json=_rr_payload(material["id"]), headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "WAITING_DOA"
    assert body["total_estimated_value"] == 1500.0  # 3 * 500
    assert len(body["line_items"]) == 1
    assert body["rr_number"].startswith("RR-1")


def test_create_rr_invalid_material(client, store):
    make_user(store, employee_code="EMP021", role="END_USER")
    headers = auth_headers(client, "EMP021")

    resp = client.post("/api/rr", json=_rr_payload(999999), headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_create_rr_zero_quantity_rejected(client, store):
    make_user(store, employee_code="EMP022", role="END_USER")
    material = make_material(store, material_code="500-79002")
    headers = auth_headers(client, "EMP022")

    resp = client.post(
        "/api/rr",
        json=_rr_payload(material["id"], line_items=[{"material_id": material["id"], "quantity": 0}]),
        headers=headers,
    )
    assert resp.status_code == 422


def test_create_rr_inactive_material_rejected(client, store):
    make_user(store, employee_code="EMP023", role="END_USER")
    material = make_material(store, material_code="500-79003", active=False)
    headers = auth_headers(client, "EMP023")

    resp = client.post("/api/rr", json=_rr_payload(material["id"]), headers=headers)
    assert resp.status_code == 422


def test_get_rr_not_found(client):
    resp = client.get("/api/rr/999999")
    assert resp.status_code == 404


def test_rr_creates_doa_approval_record(client, store):
    make_user(store, employee_code="EMP024", role="END_USER")
    material = make_material(store, material_code="500-79004")
    headers = auth_headers(client, "EMP024")

    resp = client.post("/api/rr", json=_rr_payload(material["id"]), headers=headers)
    rr_id = resp.json()["id"]

    approvals = store.approvals.filter(lambda a: a["rr_id"] == rr_id)
    assert len(approvals) == 1
    assert approvals[0]["status"] == "PENDING"
    assert approvals[0]["approval_type"] == "DOA"
