"""Initiative 8 -- refurbishable spares tracking.

The tests are organised around the six pilot scenarios in the Initiative 8 document, so
each success criterion there maps onto something executable here:

  1. Identification & detection   -> TestIdentificationAndDetection
  2. Declaration, manual path     -> TestManualDeclarationGate
  3. Declaration, MRP path        -> TestMrpDeclarationGate
  4. Duplicate alert, Layer 1     -> TestLayer1DuplicateGuard
  5. Duplicate alert, Layer 2     -> TestLayer2ConversationalGuard
  6. Register accuracy            -> TestRegisterAccuracy

Plus TestExistingBehaviourPreserved, which guards the thing most likely to break quietly:
repair documents living in the same pr/po tables must stay out of the Initiative 9 lane.
"""

from datetime import date, timedelta

from tests.conftest import (
    auth_headers,
    make_material,
    make_repair_chain,
    make_repairable_material,
    make_user,
)

from app.services import attestation_service, repair_register_service, repair_service
from app.services.csv_store import (
    ATTESTATION_STATUS_COMPLETE,
    ATTESTATION_STATUS_PENDING,
    DOC_TYPE_NEW_BUY,
    is_repairable_code,
)


def _rr_payload(material, **overrides):
    payload = {
        "plant": "Gamsberg",
        "department": "Plant Maintenance",
        "required_date": (date.today() + timedelta(days=30)).isoformat(),
        "purpose": "Replacement unit",
        "priority": "Normal",
        "line_items": [{"material_id": material["id"], "quantity": 1}],
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------- scenario 1
class TestIdentificationAndDetection:
    def test_80_series_code_identifies_a_repairable(self):
        assert is_repairable_code("80-10051") is True
        assert is_repairable_code("500-10051") is False
        assert is_repairable_code(None) is False
        assert is_repairable_code("") is False

    def test_open_chain_is_detected_for_the_right_material_and_plant(self, store):
        material = make_repairable_material(store)
        make_repair_chain(store, material, plant="Gamsberg")

        result = repair_service.check_duplicate(store, material["id"], "Gamsberg")
        assert result["is_repairable"] is True
        assert result["has_active_chain"] is True
        assert len(result["chains"]) == 1
        assert result["total_quantity_under_repair"] == 2

    def test_chain_at_another_plant_does_not_raise_a_false_alarm(self, store):
        """A unit under repair for Gamsberg does nothing for a shortage at BMM."""
        material = make_repairable_material(store)
        make_repair_chain(store, material, plant="Gamsberg")

        assert repair_service.check_duplicate(store, material["id"], "BMM")["has_active_chain"] is False

    def test_no_false_detection_on_a_material_with_no_open_documents(self, store):
        plain = make_material(store, material_code="500-99001")
        result = repair_service.check_duplicate(store, plain["id"], "Gamsberg")
        assert result["is_repairable"] is False
        assert result["has_active_chain"] is False
        assert result["chains"] == []

    def test_a_returned_repair_is_no_longer_an_active_chain(self, store):
        """Detection is live, not 'this was repaired at some point'."""
        material = make_repairable_material(store)
        make_repair_chain(store, material, delivered=True)

        assert repair_service.check_duplicate(store, material["id"], "Gamsberg")["has_active_chain"] is False

    def test_a_repair_requisition_with_no_po_is_still_an_active_chain(self, store):
        material = make_repairable_material(store)
        make_repair_chain(store, material, with_po=False)

        result = repair_service.check_duplicate(store, material["id"], "Gamsberg")
        assert result["has_active_chain"] is True
        assert result["chains"][0]["stage"] == "AWAITING_VENDOR_DISPATCH"
        assert result["chains"][0]["repair_po_number"] is None


# ---------------------------------------------------------------- scenario 2
class TestManualDeclarationGate:
    def test_requisition_for_a_repairable_is_refused_without_a_declaration(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)

        resp = client.post("/api/rr", json=_rr_payload(material), headers=auth_headers(client, "T001"))
        assert resp.status_code == 422
        assert resp.json()["error"]["details"]["code"] == "attestation_required"
        assert store.rr.all() == []

    def test_requisition_succeeds_once_declared_and_the_declaration_is_logged(self, client, store):
        user = make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)

        resp = client.post(
            "/api/rr",
            json=_rr_payload(material, attestation_confirmed=True),
            headers=auth_headers(client, "T001"),
        )
        assert resp.status_code == 200, resp.text

        rr_id = resp.json()["id"]
        declarations = attestation_service.for_rr(store, rr_id)
        assert len(declarations) == 1
        assert declarations[0]["status"] == ATTESTATION_STATUS_COMPLETE
        assert declarations[0]["origin"] == "MANUAL"
        assert declarations[0]["declared_by"] == user["id"]
        assert declarations[0]["declared_at"] is not None

    def test_declaration_is_mirrored_into_the_audit_trail(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        client.post(
            "/api/rr",
            json=_rr_payload(material, attestation_confirmed=True),
            headers=auth_headers(client, "T001"),
        )
        actions = {row["action"] for row in store.audit_logs.all()}
        assert "ATTESTATION_DECLARED" in actions

    def test_non_repairable_material_needs_no_declaration(self, client, store):
        """The gate must not change behaviour for the ordinary new-buy flow."""
        make_user(store, employee_code="T001", role="END_USER")
        plain = make_material(store, material_code="500-99001")

        resp = client.post("/api/rr", json=_rr_payload(plain), headers=auth_headers(client, "T001"))
        assert resp.status_code == 200, resp.text
        assert attestation_service.for_rr(store, resp.json()["id"]) == []


# ---------------------------------------------------------------- scenario 3
class TestMrpDeclarationGate:
    def _auto_raised_rr_awaiting_declaration(self, store, material):
        """An MRP-raised requisition saves flagged, with the declaration still pending."""
        rr_id = store.rr.next_id()
        store.rr.insert(
            {
                "id": rr_id, "rr_number": f"RR-{1000 + rr_id}", "requester_id": 1,
                "plant": "Gamsberg", "department": "Plant Maintenance", "area": "Plant",
                "trigger_type": "MIN_MAX_AUTO", "creation_date": date.today().isoformat(),
                "required_date": (date.today() + timedelta(days=30)).isoformat(),
                "purpose": "Auto replenishment", "status": "WAITING_DOA", "priority": "Normal",
                "total_estimated_value": 1000.0, "source_system": "synthetic",
                "duplicate_flag": False, "duplicate_context": None,
                "created_at": date.today().isoformat(), "updated_at": date.today().isoformat(),
            }
        )
        attestation_service.record(
            store, rr_id=rr_id, material_id=material["id"], plant="Gamsberg",
            origin="MRP", declared_by=None, status=ATTESTATION_STATUS_PENDING,
        )
        approval_id = store.approvals.next_id()
        store.approvals.insert(
            {
                "id": approval_id, "approval_type": "DOA", "entity_type": "RR", "rr_id": rr_id,
                "pr_id": None, "po_id": None, "approval_level": 1, "approver_id": None,
                "approver_role": "ENGINEERING_MANAGER", "status": "PENDING", "match_tier": None,
                "urgency": "Normal", "related_chat_session_id": None,
                "submitted_at": date.today().isoformat(), "action_at": None, "comments": None,
            }
        )
        return rr_id, approval_id

    def test_approval_is_blocked_while_the_declaration_is_pending(self, client, store):
        make_user(store, employee_code="T002", role="ENGINEERING_MANAGER")
        material = make_repairable_material(store)
        _, approval_id = self._auto_raised_rr_awaiting_declaration(store, material)

        resp = client.post(f"/api/approvals/{approval_id}/approve", headers=auth_headers(client, "T002"))
        assert resp.status_code == 422
        assert resp.json()["error"]["details"]["code"] == "attestation_pending"
        assert store.approvals.get(approval_id)["status"] == "PENDING"

    def test_approval_proceeds_once_a_planner_declares(self, client, store):
        make_user(store, employee_code="T002", role="ENGINEERING_MANAGER")
        material = make_repairable_material(store)
        rr_id, approval_id = self._auto_raised_rr_awaiting_declaration(store, material)
        headers = auth_headers(client, "T002")

        pending = client.get("/api/repair/attestations/pending", headers=headers).json()
        assert len(pending) == 1
        assert pending[0]["trigger_type"] == "MIN_MAX_AUTO"

        declared = client.post(
            f"/api/repair/attestations/{pending[0]['attestation_id']}/declare",
            json={"note": "Housing cracked."}, headers=headers,
        )
        assert declared.status_code == 200
        assert declared.json()["status"] == ATTESTATION_STATUS_COMPLETE
        assert declared.json()["declared_by_name"] is not None

        resp = client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
        assert resp.status_code == 200, resp.text
        assert store.rr.get(rr_id)["status"] == "MRP_PROCESSING"

    def test_approver_sees_the_pending_declaration_on_the_approval(self, client, store):
        make_user(store, employee_code="T002", role="ENGINEERING_MANAGER")
        material = make_repairable_material(store)
        self._auto_raised_rr_awaiting_declaration(store, material)

        item = client.get("/api/approvals", headers=auth_headers(client, "T002")).json()["items"][0]
        assert item["attestation_pending"] is True
        assert item["attestation"]["status"] == ATTESTATION_STATUS_PENDING


# ---------------------------------------------------------------- scenario 4
class TestLayer1DuplicateGuard:
    def test_duplicate_is_flagged_but_never_blocked(self, client, store):
        """The guard is advisory: a genuine second failure must remain possible."""
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material, plant="Gamsberg")

        resp = client.post(
            "/api/rr",
            json=_rr_payload(material, attestation_confirmed=True),
            headers=auth_headers(client, "T001"),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["duplicate_flag"] is True
        assert body["duplicate_context"]["chain_count"] == 1

    def test_context_names_the_open_repair_document(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        chain = make_repair_chain(store, material, plant="Gamsberg")

        resp = client.post(
            "/api/rr",
            json=_rr_payload(material, attestation_confirmed=True),
            headers=auth_headers(client, "T001"),
        )
        detected = resp.json()["duplicate_context"]["materials"][0]["chains"][0]
        assert detected["repair_po_number"] == f"RPO-{9000 + chain['po_id']}"
        assert detected["expected_return"] == chain["expected_return"]

    def test_no_flag_when_nothing_is_under_repair(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)

        resp = client.post(
            "/api/rr",
            json=_rr_payload(material, attestation_confirmed=True),
            headers=auth_headers(client, "T001"),
        )
        assert resp.json()["duplicate_flag"] is False
        assert resp.json()["duplicate_context"] is None

    def test_flag_and_declaration_reach_the_approver(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material, plant="Gamsberg")
        headers = auth_headers(client, "T001")

        client.post("/api/rr", json=_rr_payload(material, attestation_confirmed=True), headers=headers)

        item = client.get("/api/approvals", headers=headers).json()["items"][0]
        assert item["duplicate_flag"] is True
        assert item["duplicate_context"]["chain_count"] == 1
        assert item["attestation"]["status"] == ATTESTATION_STATUS_COMPLETE
        assert item["attestation_pending"] is False

    def test_economic_evaluation_prices_the_repair_from_the_real_document(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store, price=1000.0)
        make_repair_chain(store, material, quantity=2, repair_value=400.0)

        econ = client.get(
            "/api/repair/economics",
            params={"material_id": material["id"], "plant": "Gamsberg"},
            headers=auth_headers(client, "T001"),
        ).json()

        assert econ["repair_cost_basis"] == "OPEN_REPAIR_PO"
        assert econ["repair_total_cost"] == 400.0
        assert econ["new_total_cost"] == 2000.0
        assert econ["saving_if_repair_used"] == 1600.0

    def test_overdue_repair_never_reads_as_arriving_sooner(self, store):
        material = make_repairable_material(store, price=1000.0)
        make_repair_chain(store, material, days_ago=90, expected_in_days=10)

        econ = repair_service.economic_evaluation(store, material["id"], "Gamsberg")
        assert econ["repair_is_overdue"] is True
        assert econ["repair_arrives_sooner"] is False


# ---------------------------------------------------------------- scenario 5
class TestLayer2ConversationalGuard:
    def _advance(self, client, headers, session_id=None, **kwargs):
        body = {"session_id": session_id, **kwargs}
        resp = client.post("/api/chat", json=body, headers=headers)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_assistant_surfaces_the_chain_then_requires_the_declaration(self, client, store):
        make_user(store, employee_code="T001", role="END_USER", department="Plant Maintenance")
        material = make_repairable_material(store, price=1000.0)
        make_repair_chain(store, material, quantity=2, repair_value=400.0)
        headers = auth_headers(client, "T001")

        turn = self._advance(client, headers, message=f"I need 1 {material['description']}")
        session_id = turn["session_id"]
        turn = self._advance(client, headers, session_id, message="next week")

        text = turn["message"]["text"]
        option_ids = {o["id"] for o in (turn["message"]["options"] or [])}
        assert "already in progress" in text
        assert "proceed_despite_repair" in option_ids

        turn = self._advance(client, headers, session_id, option_id="proceed_despite_repair")
        option_ids = {o["id"] for o in (turn["message"]["options"] or [])}
        assert "confirm_attestation" in option_ids
        assert "cannot be repaired" in turn["message"]["text"]

        turn = self._advance(client, headers, session_id, option_id="confirm_attestation")
        assert "confirm_create_rr" in {o["id"] for o in (turn["message"]["options"] or [])}

        turn = self._advance(client, headers, session_id, option_id="confirm_create_rr")
        assert "has been created" in turn["message"]["text"]

        rr = store.rr.all()[0]
        assert rr["duplicate_flag"] is True
        declarations = attestation_service.for_rr(store, rr["id"])
        assert declarations[0]["origin"] == "CHAT"
        assert declarations[0]["status"] == ATTESTATION_STATUS_COMPLETE

    def test_assistant_cannot_create_without_the_user_confirming(self, store):
        """The assistant has no way to set the declaration on the user's behalf: the tool
        goes through the same service, and the service refuses."""
        from app.ai.tools import ToolContext, execute_tool

        user = make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        ctx = ToolContext(store=store, current_user=user)

        result = execute_tool(ctx, "create_rr", {
            "plant": "Gamsberg", "department": "Plant Maintenance",
            "required_date": (date.today() + timedelta(days=20)).isoformat(),
            "purpose": "Bypass attempt", "line_items": [{"material_id": material["id"], "quantity": 1}],
        })
        assert "error" in result
        assert store.rr.all() == []

    def test_check_repair_chain_tool_is_read_only_and_accurate(self, store):
        from app.ai.tools import ToolContext, execute_tool

        user = make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material)

        result = execute_tool(ToolContext(store=store, current_user=user), "check_repair_chain",
                              {"material_id": material["id"], "plant": "Gamsberg"})
        assert result["has_active_chain"] is True
        assert result["chains"][0]["quantity_under_repair"] == 2
        assert store.rr.all() == []  # nothing was written


# ---------------------------------------------------------------- scenario 6
class TestRegisterAccuracy:
    def test_register_reports_stock_beside_quantity_under_repair(self, store):
        material = make_repairable_material(store, stock_level=4, reorder_point=2)
        make_repair_chain(store, material, quantity=3)

        register = repair_register_service.get_register(store)
        assert register["total"] == 1
        row = register["items"][0]
        assert row["stock_on_hand"] == 4
        assert row["reorder_point"] == 2
        assert row["quantity_under_repair"] == 3
        assert row["reorder_triggered"] is False

    def test_stock_at_the_reorder_point_is_flagged_as_duplicate_risk(self, store):
        material = make_repairable_material(store, stock_level=1, reorder_point=3)
        make_repair_chain(store, material)

        row = repair_register_service.get_register(store)["items"][0]
        assert row["reorder_triggered"] is True
        assert row["duplicate_risk"] is True
        assert repair_register_service.get_register(store)["summary"]["duplicate_risk_count"] == 1

    def test_overdue_chain_is_reported_with_days_overdue(self, store):
        material = make_repairable_material(store)
        make_repair_chain(store, material, days_ago=40, expected_in_days=10)

        row = repair_register_service.get_register(store)["items"][0]
        assert row["overdue"] is True
        assert row["days_overdue"] == 30
        assert repair_register_service.get_register(store)["summary"]["overdue_count"] == 1

    def test_returned_chain_leaves_the_register(self, store):
        material = make_repairable_material(store)
        make_repair_chain(store, material, delivered=True)
        assert repair_register_service.get_register(store)["total"] == 0

    def test_filters_narrow_the_register(self, store):
        a = make_repairable_material(store, material_code="80-99001")
        b = make_repairable_material(store, material_code="80-99002")
        make_repair_chain(store, a, plant="Gamsberg")
        make_repair_chain(store, b, plant="BMM", days_ago=40, expected_in_days=10)

        assert repair_register_service.get_register(store)["total"] == 2
        assert repair_register_service.get_register(store, plant="BMM")["total"] == 1
        assert repair_register_service.get_register(store, status="OVERDUE")["total"] == 1
        assert repair_register_service.get_register(store, status="IN_FLIGHT")["total"] == 1
        assert repair_register_service.get_register(store, search="80-99001")["total"] == 1

    def test_register_endpoint_matches_the_service(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material)

        body = client.get("/api/repair/register", headers=auth_headers(client, "T001")).json()
        assert body["total"] == 1
        assert body["summary"]["open_chain_count"] == 1
        assert body["items"][0]["material_code"] == material["material_code"]


# ------------------------------------------ Initiative 10 (scoped) -- register queries
class TestConversationalRegisterQueries:
    """Initiative 8 SS3.4/SS5.2 require the register to be queryable through the chatbot.

    That is the only Initiative 10 capability Initiative 8 depends on, so it is tested
    here rather than as part of a wider Initiative 10 suite.
    """

    def _ask(self, client, headers, text):
        resp = client.post("/api/chat", json={"message": text}, headers=headers)
        assert resp.status_code == 200, resp.text
        return resp.json()["message"]

    def test_classifier_separates_questions_from_requests(self):
        from app.ai.repair_queries import looks_like_repair_query

        # Questions about repairs
        assert looks_like_repair_query("What is out for repair?")
        assert looks_like_repair_query("Which repairs are overdue?")
        assert looks_like_repair_query("Is the impeller under repair?")
        assert looks_like_repair_query("Show me the repair register")
        # The phrasing that used to start a requisition by accident
        assert looks_like_repair_query("I need to know what's out for repair")

        # The reorder-point view is a register question. "reorder" contains the RR keyword
        # "order", so this has to win on the multi-word phrase.
        assert looks_like_repair_query("Anything at the reorder point?")

        # Requests for parts -- must NOT be treated as questions
        assert not looks_like_repair_query("I need 2 pump seals")
        assert not looks_like_repair_query("I need a repair kit for the pump")
        assert not looks_like_repair_query("Please order 3 ball valves")
        assert not looks_like_repair_query("Order a new impeller")
        assert not looks_like_repair_query("")

    def test_reorder_point_question_lists_the_duplicate_risk_set(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        at_risk = make_repairable_material(store, material_code="80-99001", stock_level=1, reorder_point=5)
        healthy = make_repairable_material(store, material_code="80-99002", stock_level=40, reorder_point=2)
        make_repair_chain(store, at_risk)
        make_repair_chain(store, healthy)

        text = self._ask(client, auth_headers(client, "T001"), "Anything at the reorder point?")["text"]
        assert "reorder point" in text
        assert "80-99001" in text
        assert "80-99002" not in text

    def test_general_query_summarises_the_register(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material)

        text = self._ask(client, auth_headers(client, "T001"), "What is out for repair?")["text"]
        assert "Currently out for repair" in text
        assert material["material_code"] in text

    def test_overdue_query_narrows_to_overdue_chains(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        late = make_repairable_material(store, material_code="80-99001")
        ontime = make_repairable_material(store, material_code="80-99002")
        make_repair_chain(store, late, days_ago=60, expected_in_days=10)
        make_repair_chain(store, ontime, days_ago=2, expected_in_days=40)

        text = self._ask(client, auth_headers(client, "T001"), "Which repairs are overdue?")["text"]
        assert "Overdue repairs" in text
        assert "80-99001" in text
        assert "80-99002" not in text

    def test_material_query_reports_that_material_only(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store, material_code="80-99001", price=1000.0)
        make_repair_chain(store, material, quantity=2, repair_value=400.0)

        text = self._ask(client, auth_headers(client, "T001"), "Is 80-99001 under repair?")["text"]
        assert "80-99001" in text
        assert "repair chain open" in text
        # The economic comparison rides along, as it does in the Layer 2 alert.
        assert "R400" in text and "R2,000" in text

    def test_material_with_no_open_chain_says_so(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        make_repairable_material(store, material_code="80-99001")

        text = self._ask(client, auth_headers(client, "T001"), "Is 80-99001 under repair?")["text"]
        assert "Nothing is currently out for repair" in text

    def test_non_repairable_material_is_explained_not_guessed(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        make_material(store, material_code="500-99001")

        text = self._ask(client, auth_headers(client, "T001"), "Is 500-99001 under repair?")["text"]
        assert "not a repairable item" in text

    def test_plant_is_honoured_in_the_question(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        a = make_repairable_material(store, material_code="80-99001")
        b = make_repairable_material(store, material_code="80-99002")
        make_repair_chain(store, a, plant="Gamsberg")
        make_repair_chain(store, b, plant="BMM")

        text = self._ask(client, auth_headers(client, "T001"), "What is out for repair at BMM?")["text"]
        assert "at BMM" in text
        assert "80-99002" in text
        assert "80-99001" not in text

    def test_a_question_never_starts_a_requisition(self, client, store):
        """The regression this routing exists to prevent."""
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material)
        headers = auth_headers(client, "T001")

        message = self._ask(client, headers, "I need to know what's out for repair")
        assert "Currently out for repair" in message["text"]
        assert "Which material do you need" not in message["text"]
        assert store.rr.all() == []

    def test_a_real_request_still_starts_a_requisition(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        make_material(store, material_code="500-99001")

        message = self._ask(client, auth_headers(client, "T001"), "I need 2 Test material 500-99001")
        assert "out for repair" not in message["text"].lower()

    def test_a_draft_in_progress_is_not_hijacked(self, client, store):
        """A half-finished requisition wins -- answering a question mid-draft would lose it."""
        make_user(store, employee_code="T001", role="END_USER")
        make_material(store, material_code="500-99001")
        make_repairable_material(store, material_code="80-99001")
        headers = auth_headers(client, "T001")

        first = client.post(
            "/api/chat", json={"message": "I need 2 Test material 500-99001"}, headers=headers
        ).json()
        session_id = first["session_id"]

        follow = client.post(
            "/api/chat",
            json={"session_id": session_id, "message": "what is out for repair?"},
            headers=headers,
        ).json()
        # Still collecting the draft, not answering the question.
        assert "Currently out for repair" not in follow["message"]["text"]

    def test_query_is_read_only(self, client, store):
        make_user(store, employee_code="T001", role="END_USER")
        material = make_repairable_material(store)
        make_repair_chain(store, material)
        before = (len(store.rr.all()), len(store.attestations.all()), len(store.pr.all()))

        self._ask(client, auth_headers(client, "T001"), "What is out for repair?")

        assert (len(store.rr.all()), len(store.attestations.all()), len(store.pr.all())) == before


# ------------------------------------------------------- regression guard
class TestExistingBehaviourPreserved:
    """Initiative 8 put repair documents in the same pr/po tables the Initiative 9
    analytics read. They must stay out of that lane, or every existing number silently
    changes meaning."""

    def _new_buy_pr(self, store, material, status="OPEN"):
        pr_id = store.pr.next_id()
        store.pr.insert(
            {
                "id": pr_id, "pr_number": f"PR-{2000 + pr_id}", "rr_id": None,
                "creation_date": (date.today() - timedelta(days=5)).isoformat(),
                "required_date": date.today().isoformat(), "status": status,
                "buyer_id": None, "plant": "Gamsberg", "total_value": 500.0,
                "source_system": "test", "doc_type": DOC_TYPE_NEW_BUY,
                "duplicate_flag": False, "duplicate_context": None,
            }
        )
        return pr_id

    def test_open_pr_po_analytics_exclude_repair_documents(self, store):
        from app.services import analytics_service

        material = make_repairable_material(store)
        self._new_buy_pr(store, material)
        make_repair_chain(store, material)  # adds an open repair PR + PO

        result = analytics_service.get_open_pr_po(store, page=1, page_size=50)
        assert result["open_pr_count"] == 1
        assert result["open_po_count"] == 0
        assert all(not n.startswith("RPR-") and not n.startswith("RPO-") for n in
                   (i["number"] for i in result["items"]))

    def test_vzi_dashboard_excludes_repair_documents(self, store):
        from app.services import dashboard_service

        material = make_repairable_material(store)
        self._new_buy_pr(store, material)
        make_repair_chain(store, material)

        totals = dashboard_service.get_vzi_dashboard(store)["pr_summary"]
        assert sum(r["material"] + r["service"] for r in totals) == 1

    def test_repair_po_does_not_corrupt_the_material_price(self, store):
        """A refurbishment costs a fraction of a new unit -- if it landed in last_po_price
        the economic comparison would make every repair look free."""
        material = make_repairable_material(store, price=1000.0)
        make_repair_chain(store, material, quantity=2, repair_value=400.0)

        assert store.materials.get(material["id"])["last_po_price"] == 1000.0
        econ = repair_service.economic_evaluation(store, material["id"], "Gamsberg")
        assert econ["new_unit_cost"] == 1000.0
