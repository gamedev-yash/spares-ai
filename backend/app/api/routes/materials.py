from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.core.exceptions import NotFoundError
from app.schemas.common import Page
from app.schemas.materials import MaterialOut
from app.services.csv_store import DataStore

router = APIRouter(prefix="/materials", tags=["materials"])

SORTABLE_FIELDS = ["material_code", "description", "last_po_price", "lead_time_days", "stock_level"]


@router.get("", response_model=Page[MaterialOut])
def list_materials(
    store: DataStore = Depends(get_store),
    q: str | None = Query(default=None, description="Search material code, description, or manufacturer part no"),
    material_group: str | None = None,
    plant: str | None = None,
    criticality: str | None = None,
    lifecycle_status: str | None = None,
    active: bool | None = True,
    sort_by: Literal["material_code", "description", "last_po_price", "lead_time_days", "stock_level"] = "material_code",
    sort_dir: Literal["asc", "desc"] = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[MaterialOut]:
    items = store.materials.all()

    if q:
        needle = q.lower()
        items = [
            m for m in items
            if needle in (m.get("material_code") or "").lower()
            or needle in (m.get("description") or "").lower()
            or needle in (m.get("manufacturer_part_no") or "").lower()
            or needle in (m.get("manufacturer") or "").lower()
        ]
    if material_group:
        items = [m for m in items if m.get("material_group") == material_group]
    if plant:
        items = [m for m in items if m.get("plant") == plant]
    if criticality:
        items = [m for m in items if m.get("criticality") == criticality]
    if lifecycle_status:
        items = [m for m in items if m.get("lifecycle_status") == lifecycle_status]
    if active is not None:
        items = [m for m in items if bool(m.get("active")) == active]

    def sort_key(m: dict):
        value = m.get(sort_by)
        return (value is None, value)

    items = sorted(items, key=sort_key, reverse=(sort_dir == "desc"))

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return Page(items=[MaterialOut.model_validate(m) for m in page_items], total=total, page=page, page_size=page_size)


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(material_id: int, store: DataStore = Depends(get_store)) -> MaterialOut:
    material = store.materials.get(material_id)
    if material is None:
        raise NotFoundError(f"Material {material_id} not found")
    return MaterialOut.model_validate(material)
