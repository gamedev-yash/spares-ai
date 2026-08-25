from tests.conftest import auth_headers, make_material, make_user


def test_audit_list_no_auth_required(client):
    resp = client.get("/api/audit")
    assert resp.status_code == 200


def test_rr_creation_writes_audit_entry(client, store):
    make_user(store, employee_code="EMP060", role="END_USER")
    material = make_material(store, material_code="500-82001")
    headers = auth_headers(client, "EMP060")

    resp = client.post(
        "/api/rr",
        json={
            "plant": "Gamsberg",
            "department": "Mechanical Engineering",
            "required_date": "2026-12-01",
            "purpose": "Test",
            "priority": "Normal",
            "line_items": [{"material_id": material["id"], "quantity": 1}],
        },
        headers=headers,
    )
    rr_id = resp.json()["id"]

    audit_resp = client.get("/api/audit", params={"entity_type": "RR", "action": "RR_CREATED"})
    assert audit_resp.status_code == 200
    entries = audit_resp.json()["items"]
    assert any(e["entity_id"] == rr_id for e in entries)


def test_audit_filter_by_entity_type(client):
    resp = client.get("/api/audit", params={"entity_type": "PO"})
    assert resp.status_code == 200
    assert all(e["entity_type"] == "PO" for e in resp.json()["items"])


def test_audit_pagination_shape(client):
    resp = client.get("/api/audit", params={"page": 1, "page_size": 5})
    body = resp.json()
    assert body["page"] == 1
    assert body["page_size"] == 5
    assert len(body["items"]) <= 5
