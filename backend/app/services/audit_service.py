from datetime import datetime, timezone
from typing import Any

from app.services.csv_store import DataStore, Row


def record_audit(
    store: DataStore,
    *,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
) -> Row:
    """Append an audit row -- immediately persisted (there is no shared transaction to
    piggyback on without a DB session)."""
    entry_id = store.audit_logs.next_id()
    return store.audit_logs.insert(
        {
            "id": entry_id,
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "old_value": old_value,
            "new_value": new_value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": None,
            "device_metadata": None,
        }
    )
