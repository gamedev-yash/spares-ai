import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_store
from app.main import app
from app.services import csv_store as cs
from app.services.csv_store import DataStore, Row

TABLE_SCHEMAS = {
    "users": (cs.USERS_COLUMNS, cs.USERS_TYPES),
    "materials": (cs.MATERIALS_COLUMNS, cs.MATERIALS_TYPES),
    "suppliers": (cs.SUPPLIERS_COLUMNS, cs.SUPPLIERS_TYPES),
    "rr": (cs.RR_COLUMNS, cs.RR_TYPES),
    "rr_line_items": (cs.RR_LINE_ITEMS_COLUMNS, cs.RR_LINE_ITEMS_TYPES),
    "pr": (cs.PR_COLUMNS, cs.PR_TYPES),
    "pr_line_items": (cs.PR_LINE_ITEMS_COLUMNS, cs.PR_LINE_ITEMS_TYPES),
    "po": (cs.PO_COLUMNS, cs.PO_TYPES),
    "po_line_items": (cs.PO_LINE_ITEMS_COLUMNS, cs.PO_LINE_ITEMS_TYPES),
    "process_stage_events": (cs.PROCESS_STAGE_EVENTS_COLUMNS, cs.PROCESS_STAGE_EVENTS_TYPES),
    "approvals": (cs.APPROVALS_COLUMNS, cs.APPROVALS_TYPES),
    "audit_logs": (cs.AUDIT_LOGS_COLUMNS, cs.AUDIT_LOGS_TYPES),
    "notifications": (cs.NOTIFICATIONS_COLUMNS, cs.NOTIFICATIONS_TYPES),
    "attestations": (cs.ATTESTATIONS_COLUMNS, cs.ATTESTATIONS_TYPES),
}


@pytest.fixture()
def store(tmp_path) -> DataStore:
    """A fresh, empty CSV-backed store per test -- no database, no shared state."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    for name, (columns, _types) in TABLE_SCHEMAS.items():
        (data_dir / f"{name}.csv").write_text(",".join(columns) + "\n", encoding="utf-8")
    (data_dir / "situation_analysis.csv").write_text(
        "section,pr_po_number,unit,area,type,category,value_zar,count,aging_bucket,root_cause_category,"
        "primary_cause_detail,sub_causes,badge,stuck_with_person,stuck_with_role,urgency,month,days_lost,session_id\n",
        encoding="utf-8",
    )
    return DataStore(data_dir)


@pytest.fixture()
def client(store: DataStore):
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_user(store: DataStore, *, employee_code: str, role: str, plant: str = "Gamsberg", department: str = "Procurement", active: bool = True) -> Row:
    return store.users.insert(
        {
            "id": store.users.next_id(),
            "employee_code": employee_code,
            "name": f"Test {employee_code}",
            "email": f"{employee_code.lower()}@spares-ai-demo.local",
            "department": department,
            "role": role,
            "plant": plant,
            "active": active,
        }
    )


def make_material(
    store: DataStore,
    *,
    material_code: str = "500-99001",
    price: float = 1000.0,
    group: str = "Bearings",
    active: bool = True,
    stock_level: int = 10,
    reorder_point: int = 3,
    repair_cost_factor: float | None = None,
) -> Row:
    now = datetime.now(timezone.utc).isoformat()
    return store.materials.insert(
        {
            "id": store.materials.next_id(),
            "material_code": material_code,
            "description": f"Test material {material_code}",
            "material_group": group,
            "material_type": "Test Type",
            "plant": "Gamsberg",
            "storage_location": "GSB-MAIN-WH",
            "unit_of_measure": "EA",
            "criticality": "MEDIUM",
            "lifecycle_status": "Active",
            "service_code": None,
            "manufacturer": None,
            "manufacturer_part_no": None,
            "last_po_price": price,
            "last_vendor": None,
            "stock_level": stock_level,
            "reorder_point": reorder_point,
            "lead_time_days": 14,
            "repair_cost_factor": repair_cost_factor,
            "active": active,
            "created_at": now,
            "updated_at": now,
        }
    )


def make_repairable_material(store: DataStore, *, material_code: str = "80-99001", **kwargs) -> Row:
    """Initiative 8: a material carrying the 80-series repairable convention."""
    kwargs.setdefault("group", "Pumps")
    kwargs.setdefault("repair_cost_factor", 0.35)
    return make_material(store, material_code=material_code, **kwargs)


def make_repair_chain(
    store: DataStore,
    material: Row,
    *,
    plant: str = "Gamsberg",
    quantity: float = 2,
    repair_value: float = 400.0,
    days_ago: int = 10,
    expected_in_days: int = 20,
    delivered: bool = False,
    with_po: bool = True,
    supplier_id: int | None = None,
) -> dict:
    """Insert a repair PR (+ optional repair PO) for a material at a plant.

    `delivered=True` closes the chain, which is how the tests prove detection is live
    rather than 'this material was repaired at some point'."""
    opened = date.today() - timedelta(days=days_ago)
    expected = opened + timedelta(days=expected_in_days)

    pr_id = store.pr.next_id()
    store.pr.insert(
        {
            "id": pr_id, "pr_number": f"RPR-{9000 + pr_id}", "rr_id": None,
            "creation_date": opened.isoformat(), "required_date": expected.isoformat(),
            "status": "PO_CREATED" if with_po else "AWAITING_PO",
            "buyer_id": None, "plant": plant, "total_value": repair_value,
            "source_system": "test", "doc_type": cs.DOC_TYPE_REPAIR,
            "duplicate_flag": False, "duplicate_context": None,
        }
    )
    store.pr_line_items.insert(
        {
            "id": store.pr_line_items.next_id(), "pr_id": pr_id, "material_id": material["id"],
            "quantity": quantity, "unit_price": repair_value / quantity, "service_code": None,
            "description": f"Repair - {material['description']}",
            "line_status": "CLOSED" if delivered else "OPEN", "quality_flags": None,
        }
    )

    po_id = None
    if with_po:
        po_id = store.po.next_id()
        store.po.insert(
            {
                "id": po_id, "po_number": f"RPO-{9000 + po_id}", "pr_id": pr_id,
                "supplier_id": supplier_id, "creation_date": opened.isoformat(),
                "expected_delivery": expected.isoformat(),
                "status": "COMPLETED" if delivered else "OPEN",
                "total_value": repair_value, "buyer_id": None, "doc_type": cs.DOC_TYPE_REPAIR,
            }
        )
        store.po_line_items.insert(
            {
                "id": store.po_line_items.next_id(), "po_id": po_id, "material_id": material["id"],
                "quantity": quantity, "unit_price": repair_value / quantity,
                "line_total": repair_value, "delivery_date": expected.isoformat(),
                "status": "DELIVERED" if delivered else "OPEN",
            }
        )

    return {"pr_id": pr_id, "po_id": po_id, "expected_return": expected.isoformat()}


def auth_headers(client: TestClient, employee_code: str, password: str = "unused") -> dict:
    resp = client.post("/api/auth/login", json={"employee_code": employee_code, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
