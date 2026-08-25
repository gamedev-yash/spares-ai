from app.ai.tools import ToolContext, execute_tool
from tests.conftest import auth_headers, make_material, make_user


def test_chat_works_without_explicit_auth(client, store):
    make_user(store, employee_code="EMP070", role="END_USER")
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 200


def test_chat_rejects_empty_payload(client, store):
    make_user(store, employee_code="EMP070", role="END_USER")
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 422


def test_create_rr_tool_rejects_invalid_material_without_crashing(store):
    user = make_user(store, employee_code="EMP071", role="END_USER")
    ctx = ToolContext(store=store, current_user=user)

    result = execute_tool(
        ctx,
        "create_rr",
        {
            "plant": "Gamsberg",
            "department": "Procurement",
            "required_date": "2026-12-01",
            "purpose": "test",
            "line_items": [{"material_id": 999999, "quantity": 1}],
        },
    )
    assert "error" in result


def test_unknown_tool_name_returns_error_not_exception(store):
    user = make_user(store, employee_code="EMP072", role="END_USER")
    ctx = ToolContext(store=store, current_user=user)
    result = execute_tool(ctx, "delete_everything", {})
    assert "error" in result


def test_chat_demo_mode_flag_present(client, store):
    make_user(store, employee_code="EMP073", role="END_USER")
    headers = auth_headers(client, "EMP073")
    resp = client.post("/api/chat", json={"message": "hi"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["demo_mode"] is True


def test_chat_guided_rr_creation_end_to_end(client, store):
    # Two candidates so the assistant is forced through its disambiguation step at least
    # once, regardless of how many slots it manages to extract from the first message.
    make_user(store, employee_code="EMP074", role="END_USER")
    make_material(store, material_code="500-83001", group="Bearings", price=200.0)
    make_material(store, material_code="500-83002", group="Bearings", price=250.0)
    headers = auth_headers(client, "EMP074")

    turn = client.post("/api/chat", json={"message": "I need 4 bearings for pump maintenance next week"}, headers=headers)
    assert turn.status_code == 200
    session_id = turn.json()["session_id"]
    message = turn.json()["message"]

    for _ in range(5):
        options = message.get("options") or []
        if any(o["id"] == "confirm_create_rr" for o in options):
            break
        if "RR-1" in message["text"]:
            break
        assert options, f"Assistant got stuck with no options and no RR created: {message}"
        turn = client.post("/api/chat", json={"session_id": session_id, "option_id": options[0]["id"]}, headers=headers)
        message = turn.json()["message"]

    options = message.get("options") or []
    if any(o["id"] == "confirm_create_rr" for o in options):
        turn = client.post("/api/chat", json={"session_id": session_id, "option_id": "confirm_create_rr"}, headers=headers)
        message = turn.json()["message"]

    assert "RR-1" in message["text"], f"Expected a created RR, got: {message}"


def test_ai_tool_create_rr_writes_audit_entry(store):
    user = make_user(store, employee_code="EMP075", role="END_USER")
    material = make_material(store, material_code="500-83002")
    ctx = ToolContext(store=store, current_user=user)

    result = execute_tool(
        ctx,
        "create_rr",
        {
            "plant": "Gamsberg",
            "department": "Procurement",
            "required_date": "2026-12-01",
            "purpose": "test",
            "line_items": [{"material_id": material["id"], "quantity": 1}],
        },
    )
    assert "rr_id" in result

    logs = store.audit_logs.filter(lambda a: a["entity_type"] == "RR" and a["entity_id"] == result["rr_id"])
    assert any(log["action"] == "AI_TOOL_CREATE_RR" for log in logs)
