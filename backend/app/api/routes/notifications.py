from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.schemas.common import Page
from app.schemas.notifications import NotificationOut
from app.services.csv_store import DataStore, Row

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Page[NotificationOut])
def list_notifications(
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[NotificationOut]:
    items = store.notifications.filter(lambda n: n.get("recipient_id") == current_user["id"])
    if status:
        items = [n for n in items if n.get("status") == status]
    items = sorted(items, key=lambda n: n.get("created_at") or "", reverse=True)

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    return Page(items=[NotificationOut.model_validate(n) for n in page_items], total=total, page=page, page_size=page_size)
