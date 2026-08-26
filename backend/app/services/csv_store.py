"""In-memory, CSV-backed data store -- the replacement for the PostgreSQL/SQLAlchemy layer.

Each `Table` loads its CSV file into memory once (at process startup) and is the single
source of truth for that entity for the life of the process. Writes (`insert`/`update`) are
applied in memory immediately and then the *entire* file is rewritten to disk under a lock.

This is a demo/dev data layer, not a database: it is fine at the hundreds-to-low-thousands-of
-rows scale this project generates, but it is NOT safe for concurrent production workloads --
there is no transaction isolation, no WAL, no multi-process coordination. Two requests writing
to the same table at the same instant are serialized by the lock (so no corruption), but there
is no rollback if a later step in a multi-step write fails.

Chat session/message state is intentionally NOT persisted here (see DataStore.chat_sessions) --
it lives purely in memory and is lost on restart. That is a deliberate, documented limitation
for this demo build (conversations are ephemeral; RR/PR/PO/approvals/audit/notifications are not).
"""

from __future__ import annotations

import csv
import json
import threading
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

Row = dict[str, Any]

JSON_TYPE = "json"


def _coerce(value: str, col_type: Any) -> Any:
    if value is None or value == "":
        return None
    if col_type is bool:
        return value.strip().lower() in ("true", "1", "yes", "t")
    if col_type is int:
        return int(float(value))
    if col_type is float:
        return float(value)
    if col_type == JSON_TYPE:
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return value


def _stringify(value: Any, col_type: Any) -> str:
    if value is None:
        return ""
    if col_type == JSON_TYPE:
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class Table:
    """A single CSV file, loaded into memory as a list of dicts keyed by `columns`."""

    def __init__(self, path: Path, columns: list[str], column_types: dict[str, Any] | None = None, id_field: str = "id"):
        self.path = path
        self.columns = columns
        self.column_types = column_types or {}
        self.id_field = id_field
        self._lock = threading.Lock()
        self._rows: list[Row] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            self._rows = []
            return
        with self.path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            self._rows = [
                {col: _coerce(row.get(col, ""), self.column_types.get(col, str)) for col in self.columns}
                for row in reader
            ]

    def _save_locked(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.columns)
            writer.writeheader()
            for row in self._rows:
                writer.writerow({col: _stringify(row.get(col), self.column_types.get(col, str)) for col in self.columns})

    def all(self) -> list[Row]:
        return list(self._rows)

    def get(self, id_value: Any) -> Row | None:
        for row in self._rows:
            if row.get(self.id_field) == id_value:
                return row
        return None

    def filter(self, predicate: Callable[[Row], bool]) -> list[Row]:
        return [row for row in self._rows if predicate(row)]

    def next_id(self) -> int:
        ids = [row[self.id_field] for row in self._rows if isinstance(row.get(self.id_field), int)]
        return (max(ids) + 1) if ids else 1

    def insert(self, row: Row) -> Row:
        full_row = {col: row.get(col) for col in self.columns}
        with self._lock:
            self._rows.append(full_row)
            self._save_locked()
        return full_row

    def insert_many(self, rows: Iterable[Row]) -> None:
        with self._lock:
            for row in rows:
                self._rows.append({col: row.get(col) for col in self.columns})
            self._save_locked()

    def replace_all(self, rows: Iterable[Row]) -> None:
        """Discards every existing row and writes `rows` instead. Used by the synthetic
        data generator to regenerate a table from scratch on each run."""
        with self._lock:
            self._rows = [{col: row.get(col) for col in self.columns} for row in rows]
            self._save_locked()

    def update(self, id_value: Any, **changes: Any) -> Row | None:
        with self._lock:
            for row in self._rows:
                if row.get(self.id_field) == id_value:
                    row.update(changes)
                    self._save_locked()
                    return row
        return None


# ---------------------------------------------------------------------------
# Table schemas -- column order/types for every CSV file under backend/data/.
# ---------------------------------------------------------------------------

USERS_COLUMNS = ["id", "employee_code", "name", "email", "department", "role", "plant", "active"]
USERS_TYPES = {"id": int, "active": bool}

MATERIALS_COLUMNS = [
    "id", "material_code", "description", "material_group", "material_type", "plant", "storage_location",
    "unit_of_measure", "criticality", "lifecycle_status", "service_code", "manufacturer", "manufacturer_part_no",
    "last_po_price", "last_vendor", "stock_level", "reorder_point", "lead_time_days", "repair_cost_factor",
    "active", "created_at", "updated_at",
]
MATERIALS_TYPES = {
    "id": int, "last_po_price": float, "stock_level": int, "reorder_point": int, "lead_time_days": int,
    "repair_cost_factor": float, "active": bool,
}

# --- Initiative 8: repairable identification -------------------------------
# Repairable spares are identified by a material-code convention, mirroring the
# 80-series convention VZI already uses in SAP ECC (see Initiative 8 SS3.1). The
# convention -- not a separate boolean column -- is deliberately the single source
# of truth, because it is what the real solution keys off; every guard, declaration
# and register lookup resolves repairability through this one helper.
REPAIRABLE_CODE_PREFIX = "80-"


def is_repairable_code(material_code: Any) -> bool:
    return bool(material_code) and str(material_code).startswith(REPAIRABLE_CODE_PREFIX)

SUPPLIERS_COLUMNS = ["id", "supplier_code", "supplier_name", "country", "category", "rating", "active"]
SUPPLIERS_TYPES = {"id": int, "rating": float, "active": bool}

RR_COLUMNS = [
    "id", "rr_number", "requester_id", "plant", "department", "area", "trigger_type", "creation_date",
    "required_date", "purpose", "status", "priority", "total_estimated_value", "source_system",
    "duplicate_flag", "duplicate_context", "created_at", "updated_at",
]
RR_TYPES = {
    "id": int, "requester_id": int, "total_estimated_value": float,
    "duplicate_flag": bool, "duplicate_context": JSON_TYPE,
}

# `area` groups a department into the same Plant/Mining/Other buckets the VZI dashboard uses.
DEPARTMENT_AREA = {
    "Mining Operations": "Mining",
    "Processing / Plant Operations": "Plant",
    "Plant Maintenance": "Plant",
    "Mechanical Engineering": "Plant",
    "Instrumentation & Electrical": "Plant",
    "Warehouse & Stores": "Other",
    "Procurement": "Other",
    "Safety & SHEQ": "Other",
}


def area_for_department(department: str) -> str:
    return DEPARTMENT_AREA.get(department, "Other")

RR_LINE_ITEMS_COLUMNS = [
    "id", "rr_id", "line_number", "material_id", "quantity", "estimated_unit_price", "service_code",
    "description", "quality_status",
]
RR_LINE_ITEMS_TYPES = {"id": int, "rr_id": int, "line_number": int, "material_id": int, "quantity": float, "estimated_unit_price": float}

PR_COLUMNS = [
    "id", "pr_number", "rr_id", "creation_date", "required_date", "status", "buyer_id", "plant",
    "total_value", "source_system", "doc_type", "duplicate_flag", "duplicate_context",
]
PR_TYPES = {
    "id": int, "rr_id": int, "buyer_id": int, "total_value": float,
    "duplicate_flag": bool, "duplicate_context": JSON_TYPE,
}

# Initiative 8: a repair document is distinct from a new-unit document for the same
# material (Initiative 8 SS2.1). An *active repair chain* is an open, undelivered
# REPAIR pr/po for a (material, plant) pair -- see services/repair_service.py.
DOC_TYPE_NEW_BUY = "NEW_BUY"
DOC_TYPE_REPAIR = "REPAIR"

PR_LINE_ITEMS_COLUMNS = [
    "id", "pr_id", "material_id", "quantity", "unit_price", "service_code", "description", "line_status", "quality_flags",
]
PR_LINE_ITEMS_TYPES = {"id": int, "pr_id": int, "material_id": int, "quantity": float, "unit_price": float}

PO_COLUMNS = [
    "id", "po_number", "pr_id", "supplier_id", "creation_date", "expected_delivery", "status", "total_value",
    "buyer_id", "doc_type",
]
PO_TYPES = {"id": int, "pr_id": int, "supplier_id": int, "total_value": float, "buyer_id": int}

PO_LINE_ITEMS_COLUMNS = ["id", "po_id", "material_id", "quantity", "unit_price", "line_total", "delivery_date", "status"]
PO_LINE_ITEMS_TYPES = {"id": int, "po_id": int, "material_id": int, "quantity": float, "unit_price": float, "line_total": float}

PROCESS_STAGE_EVENTS_COLUMNS = [
    "id", "entity_type", "entity_id", "stage_code", "stage_name", "started_at", "completed_at", "status",
    "owner_id", "source_system",
]
PROCESS_STAGE_EVENTS_TYPES = {"id": int, "entity_id": int, "owner_id": int}

APPROVALS_COLUMNS = [
    "id", "approval_type", "entity_type", "rr_id", "pr_id", "po_id", "approval_level", "approver_id",
    "approver_role", "status", "match_tier", "urgency", "related_chat_session_id", "submitted_at",
    "action_at", "comments",
]
APPROVALS_TYPES = {"id": int, "rr_id": int, "pr_id": int, "po_id": int, "approval_level": int, "approver_id": int}

AUDIT_LOGS_COLUMNS = [
    "id", "user_id", "action", "entity_type", "entity_id", "old_value", "new_value", "timestamp",
    "ip_address", "device_metadata",
]
AUDIT_LOGS_TYPES = {"id": int, "user_id": int, "entity_id": int, "old_value": JSON_TYPE, "new_value": JSON_TYPE}

NOTIFICATIONS_COLUMNS = [
    "id", "recipient_id", "type", "title", "message", "status", "related_entity_type", "related_entity_id",
    "created_at", "read_at",
]
NOTIFICATIONS_TYPES = {"id": int, "recipient_id": int, "related_entity_id": int}

# --- Initiative 8: condition-to-repair attestations -------------------------
# The ONE piece of state the platform owns outright (Initiative 8 SS3.4 -- everything
# else in the real solution is a read-only projection of SAP). Kept as its own table
# rather than columns on `rr` so the MRP "saved but declaration still pending" case
# stays expressible, and so the declaration log is independently auditable.
#
# origin: MANUAL (requisitioner declared at creation) | MRP (auto-raised, planner must
#         declare before the RR can pass DOA) | CHAT (declared through the assistant)
# status: COMPLETE | PENDING
ATTESTATIONS_COLUMNS = [
    "id", "rr_id", "material_id", "plant", "origin", "status", "statement",
    "declared_by", "declared_at", "chain_snapshot", "created_at",
]
ATTESTATIONS_TYPES = {
    "id": int, "rr_id": int, "material_id": int, "declared_by": int, "chain_snapshot": JSON_TYPE,
}

ATTESTATION_ORIGIN_MANUAL = "MANUAL"
ATTESTATION_ORIGIN_MRP = "MRP"
ATTESTATION_ORIGIN_CHAT = "CHAT"
ATTESTATION_STATUS_COMPLETE = "COMPLETE"
ATTESTATION_STATUS_PENDING = "PENDING"

# The exact sentence a requisitioner signs. Placeholder wording pending VZI's own --
# see the Initiative 8 build plan, input #5.
ATTESTATION_STATEMENT = (
    "I confirm the existing item has been assessed and cannot be repaired."
)


class ChatStore:
    """Ephemeral, in-memory chat session/message state. Not written to disk -- see module
    docstring. Session/message ids are simple in-process counters."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.sessions: dict[int, Row] = {}
        self.messages: dict[int, list[Row]] = {}
        self._session_seq = 0
        self._message_seq = 0

    def create_session(self, user_id: int, title: str) -> Row:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._session_seq += 1
            session = {
                "id": self._session_seq, "user_id": user_id, "title": title, "status": "ACTIVE",
                "assistant_state": None, "created_at": now, "updated_at": now,
            }
            self.sessions[session["id"]] = session
            self.messages[session["id"]] = []
            return session

    def get_session(self, session_id: int) -> Row | None:
        return self.sessions.get(session_id)

    def sessions_for_user(self, user_id: int) -> list[Row]:
        return [s for s in self.sessions.values() if s["user_id"] == user_id]

    def add_message(self, session_id: int, role: str, text: str, options: list[dict] | None, created_at: str) -> Row:
        with self._lock:
            self._message_seq += 1
            message = {"id": self._message_seq, "session_id": session_id, "role": role, "text": text, "options": options, "created_at": created_at}
            self.messages.setdefault(session_id, []).append(message)
            session = self.sessions.get(session_id)
            if session is not None:
                session["updated_at"] = created_at
            return message

    def messages_for_session(self, session_id: int) -> list[Row]:
        return list(self.messages.get(session_id, []))


class DataStore:
    """Aggregates every CSV-backed table plus the ephemeral chat store. One instance is
    created at app startup (see app.api.deps.get_store) and shared by every request."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.materials = Table(data_dir / "materials.csv", MATERIALS_COLUMNS, MATERIALS_TYPES)
        self.suppliers = Table(data_dir / "suppliers.csv", SUPPLIERS_COLUMNS, SUPPLIERS_TYPES)
        self.users = Table(data_dir / "users.csv", USERS_COLUMNS, USERS_TYPES)
        self.rr = Table(data_dir / "rr.csv", RR_COLUMNS, RR_TYPES)
        self.rr_line_items = Table(data_dir / "rr_line_items.csv", RR_LINE_ITEMS_COLUMNS, RR_LINE_ITEMS_TYPES)
        self.pr = Table(data_dir / "pr.csv", PR_COLUMNS, PR_TYPES)
        self.pr_line_items = Table(data_dir / "pr_line_items.csv", PR_LINE_ITEMS_COLUMNS, PR_LINE_ITEMS_TYPES)
        self.po = Table(data_dir / "po.csv", PO_COLUMNS, PO_TYPES)
        self.po_line_items = Table(data_dir / "po_line_items.csv", PO_LINE_ITEMS_COLUMNS, PO_LINE_ITEMS_TYPES)
        self.process_stage_events = Table(data_dir / "process_stage_events.csv", PROCESS_STAGE_EVENTS_COLUMNS, PROCESS_STAGE_EVENTS_TYPES)
        self.approvals = Table(data_dir / "approvals.csv", APPROVALS_COLUMNS, APPROVALS_TYPES)
        self.audit_logs = Table(data_dir / "audit_logs.csv", AUDIT_LOGS_COLUMNS, AUDIT_LOGS_TYPES)
        self.notifications = Table(data_dir / "notifications.csv", NOTIFICATIONS_COLUMNS, NOTIFICATIONS_TYPES)
        self.attestations = Table(data_dir / "attestations.csv", ATTESTATIONS_COLUMNS, ATTESTATIONS_TYPES)

        self.chat = ChatStore()

    def default_user(self) -> Row | None:
        active = self.users.filter(lambda u: u.get("active"))
        return active[0] if active else (self.users.all()[0] if self.users.all() else None)
