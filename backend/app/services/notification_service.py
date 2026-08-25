from datetime import datetime, timezone

from app.services.csv_store import DataStore, Row


def notify(
    store: DataStore,
    *,
    recipient_id: int,
    ntype: str,
    title: str,
    message: str,
    related_entity_type: str | None = None,
    related_entity_id: int | None = None,
) -> Row:
    """In-app notification only (no email/Teams) -- immediately persisted."""
    notification_id = store.notifications.next_id()
    return store.notifications.insert(
        {
            "id": notification_id,
            "recipient_id": recipient_id,
            "type": ntype,
            "title": title,
            "message": message,
            "status": "UNREAD",
            "related_entity_type": related_entity_type,
            "related_entity_id": related_entity_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read_at": None,
        }
    )
