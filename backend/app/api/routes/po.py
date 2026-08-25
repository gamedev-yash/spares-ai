from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.core.exceptions import NotFoundError
from app.schemas.common import Page
from app.schemas.procurement import POLineItemOut, PurchaseOrderOut
from app.services.csv_store import DataStore

router = APIRouter(prefix="/po", tags=["po"])


def _hydrate(store: DataStore, po: dict) -> PurchaseOrderOut:
    lines = store.po_line_items.filter(lambda l: l["po_id"] == po["id"])
    return PurchaseOrderOut(
        **{k: po.get(k) for k in PurchaseOrderOut.model_fields if k != "line_items"},
        line_items=[POLineItemOut.model_validate(line) for line in lines],
    )


@router.get("", response_model=Page[PurchaseOrderOut])
def list_po(
    store: DataStore = Depends(get_store),
    status: str | None = None,
    supplier_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[PurchaseOrderOut]:
    items = store.po.all()
    if status:
        items = [p for p in items if p.get("status") == status]
    if supplier_id:
        items = [p for p in items if p.get("supplier_id") == supplier_id]

    items = sorted(items, key=lambda p: p.get("creation_date") or "", reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return Page(items=[_hydrate(store, p) for p in page_items], total=total, page=page, page_size=page_size)


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_po(po_id: int, store: DataStore = Depends(get_store)) -> PurchaseOrderOut:
    po = store.po.get(po_id)
    if po is None:
        raise NotFoundError(f"PO {po_id} not found")
    return _hydrate(store, po)
