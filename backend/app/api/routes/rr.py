from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.core.exceptions import ForbiddenError, NotFoundError
from app.schemas.common import Page
from app.schemas.procurement import RequestRequisitionCreate, RequestRequisitionOut, RRLineItemOut
from app.services.csv_store import DataStore, Row
from app.services.rr_service import create_rr

router = APIRouter(prefix="/rr", tags=["rr"])


def _hydrate(store: DataStore, rr: Row) -> RequestRequisitionOut:
    lines = sorted(store.rr_line_items.filter(lambda l: l["rr_id"] == rr["id"]), key=lambda l: l["line_number"])
    return RequestRequisitionOut(
        **{k: rr.get(k) for k in RequestRequisitionOut.model_fields if k != "line_items"},
        line_items=[RRLineItemOut.model_validate(line) for line in lines],
    )


@router.get("", response_model=Page[RequestRequisitionOut])
def list_rr(
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
    status: str | None = None,
    plant: str | None = None,
    mine_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[RequestRequisitionOut]:
    items = store.rr.all()
    if status:
        items = [r for r in items if r.get("status") == status]
    if plant:
        items = [r for r in items if r.get("plant") == plant]
    if mine_only:
        items = [r for r in items if r.get("requester_id") == current_user["id"]]

    items = sorted(items, key=lambda r: r.get("creation_date") or "", reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return Page(items=[_hydrate(store, rr) for rr in page_items], total=total, page=page, page_size=page_size)


@router.get("/{rr_id}", response_model=RequestRequisitionOut)
def get_rr(rr_id: int, store: DataStore = Depends(get_store)) -> RequestRequisitionOut:
    rr = store.rr.get(rr_id)
    if rr is None:
        raise NotFoundError(f"RR {rr_id} not found")
    return _hydrate(store, rr)


@router.post("", response_model=RequestRequisitionOut)
def post_rr(
    payload: RequestRequisitionCreate,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> RequestRequisitionOut:
    rr = create_rr(store, current_user, payload, source_system="manual")
    return _hydrate(store, rr)


@router.patch("/{rr_id}", response_model=RequestRequisitionOut)
def patch_rr(
    rr_id: int,
    priority: str | None = None,
    purpose: str | None = None,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> RequestRequisitionOut:
    rr = store.rr.get(rr_id)
    if rr is None:
        raise NotFoundError(f"RR {rr_id} not found")
    if rr["requester_id"] != current_user["id"] and current_user.get("role") != "ADMIN":
        raise ForbiddenError("Only the requester or an admin can edit this RR")
    if rr["status"] not in ("WAITING_DOA",):
        raise ForbiddenError(f"RR cannot be edited once it has moved past DOA (status={rr['status']})")

    changes: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if priority is not None:
        changes["priority"] = priority
    if purpose is not None:
        changes["purpose"] = purpose
    rr = store.rr.update(rr_id, **changes)
    return _hydrate(store, rr)
