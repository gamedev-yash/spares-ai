from tests.conftest import auth_headers, make_user


def test_login_success(client, store):
    make_user(store, employee_code="EMP001", role="END_USER")
    resp = client.post("/api/auth/login", json={"employee_code": "EMP001", "password": "anything"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["employee_code"] == "EMP001"
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_password_is_not_checked(client, store):
    """No authentication is required in this build -- any password for a known,
    active employee_code logs in."""
    make_user(store, employee_code="EMP002", role="END_USER")
    resp = client.post("/api/auth/login", json={"employee_code": "EMP002", "password": "whatever"})
    assert resp.status_code == 200


def test_login_unknown_user(client):
    resp = client.post("/api/auth/login", json={"employee_code": "NOBODY", "password": "x"})
    assert resp.status_code == 401


def test_routes_are_open_without_a_token(client):
    resp = client.get("/api/materials")
    assert resp.status_code == 200


def test_garbage_token_falls_back_to_default_user(client, store):
    make_user(store, employee_code="EMP005", role="END_USER")
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 200


def test_me_endpoint_returns_current_user(client, store):
    make_user(store, employee_code="EMP003", role="PROCUREMENT")
    headers = auth_headers(client, "EMP003")
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["employee_code"] == "EMP003"
    assert resp.json()["role"] == "PROCUREMENT"


def test_inactive_user_cannot_login(client, store):
    make_user(store, employee_code="EMP004", role="END_USER", active=False)
    resp = client.post("/api/auth/login", json={"employee_code": "EMP004", "password": "anything"})
    assert resp.status_code == 401
