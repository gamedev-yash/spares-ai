import sys
from datetime import datetime, timezone
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


def make_material(store: DataStore, *, material_code: str = "500-99001", price: float = 1000.0, group: str = "Bearings", active: bool = True) -> Row:
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
            "stock_level": 10,
            "lead_time_days": 14,
            "active": active,
            "created_at": now,
            "updated_at": now,
        }
    )


def auth_headers(client: TestClient, employee_code: str, password: str = "unused") -> dict:
    resp = client.post("/api/auth/login", json={"employee_code": employee_code, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
