from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page
from app.services.csv_store import DataStore

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    store: DataStore = Depends(get_store),
    entity_type: str | None = None,
    action: str | None = None,
    user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
) -> Page[AuditLogOut]:
    items = store.audit_logs.all()

    if entity_type:
        items = [a for a in items if a.get("entity_type") == entity_type]
    if action:
        items = [a for a in items if a.get("action") == action]
    if user_id:
        items = [a for a in items if a.get("user_id") == user_id]
    if date_from:
        items = [a for a in items if a.get("timestamp") and datetime.fromisoformat(a["timestamp"]) >= date_from]
    if date_to:
        items = [a for a in items if a.get("timestamp") and datetime.fromisoformat(a["timestamp"]) <= date_to]

    items = sorted(items, key=lambda a: a.get("timestamp") or "", reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    users_by_id = {u["id"]: u for u in store.users.all()}
    out = [
        AuditLogOut(
            id=a["id"],
            user_id=a.get("user_id"),
            actor_name=users_by_id.get(a.get("user_id"), {}).get("name"),
            action=a["action"],
            entity_type=a["entity_type"],
            entity_id=a.get("entity_id"),
            old_value=a.get("old_value"),
            new_value=a.get("new_value"),
            timestamp=a["timestamp"],
            ip_address=a.get("ip_address"),
        )
        for a in page_items
    ]
    return Page(items=out, total=total, page=page, page_size=page_size)
