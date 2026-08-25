from tests.conftest import make_material


def test_materials_list_no_auth_required(client):
    resp = client.get("/api/materials")
    assert resp.status_code == 200


def test_materials_search_by_code(client, store):
    make_material(store, material_code="500-77001", group="Bearings")
    make_material(store, material_code="500-77002", group="Pumps")

    resp = client.get("/api/materials", params={"q": "77001"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["material_code"] == "500-77001"


def test_materials_filter_by_group(client, store):
    make_material(store, material_code="500-77003", group="Bearings")
    make_material(store, material_code="500-77004", group="Pumps")

    resp = client.get("/api/materials", params={"material_group": "Pumps"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["material_group"] == "Pumps"


def test_materials_pagination(client, store):
    for i in range(5):
        make_material(store, material_code=f"500-780{i:02d}", group="Valves")

    resp = client.get("/api/materials", params={"material_group": "Valves", "page": 1, "page_size": 2})
    body = resp.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["page"] == 1


def test_get_material_not_found(client):
    resp = client.get("/api/materials/999999")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
