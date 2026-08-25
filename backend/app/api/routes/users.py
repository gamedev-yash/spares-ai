from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.core.exceptions import NotFoundError
from app.schemas.auth import UserOut
from app.schemas.common import Page
from app.services.csv_store import DataStore

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserOut])
def list_users(
    store: DataStore = Depends(get_store),
    role: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[UserOut]:
    items = store.users.all()
    if role:
        items = [u for u in items if u.get("role") == role]
    items = sorted(items, key=lambda u: u.get("name") or "")

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    return Page(items=[UserOut.model_validate(u) for u in page_items], total=total, page=page, page_size=page_size)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, store: DataStore = Depends(get_store)) -> UserOut:
    user = store.users.get(user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return UserOut.model_validate(user)
