from fastapi import APIRouter, Depends, Query

from app.ai.pr_quality import check_pr_quality
from app.api.deps import get_store
from app.core.exceptions import NotFoundError
from app.schemas.common import Page
from app.schemas.procurement import PRLineItemOut, PRQualityCheckOut, PurchaseRequisitionOut, QualityIssueOut
from app.services.csv_store import DataStore

router = APIRouter(prefix="/pr", tags=["pr"])


def _hydrate(store: DataStore, pr: dict) -> PurchaseRequisitionOut:
    lines = store.pr_line_items.filter(lambda l: l["pr_id"] == pr["id"])
    return PurchaseRequisitionOut(
        **{k: pr.get(k) for k in PurchaseRequisitionOut.model_fields if k != "line_items"},
        line_items=[PRLineItemOut.model_validate(line) for line in lines],
    )


@router.get("", response_model=Page[PurchaseRequisitionOut])
def list_pr(
    store: DataStore = Depends(get_store),
    status: str | None = None,
    plant: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[PurchaseRequisitionOut]:
    items = store.pr.all()
    if status:
        items = [p for p in items if p.get("status") == status]
    if plant:
        items = [p for p in items if p.get("plant") == plant]

    items = sorted(items, key=lambda p: p.get("creation_date") or "", reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return Page(items=[_hydrate(store, p) for p in page_items], total=total, page=page, page_size=page_size)


@router.get("/{pr_id}", response_model=PurchaseRequisitionOut)
def get_pr(pr_id: int, store: DataStore = Depends(get_store)) -> PurchaseRequisitionOut:
    pr = store.pr.get(pr_id)
    if pr is None:
        raise NotFoundError(f"PR {pr_id} not found")
    return _hydrate(store, pr)


@router.get("/{pr_id}/quality-check", response_model=PRQualityCheckOut)
def pr_quality_check(pr_id: int, store: DataStore = Depends(get_store)) -> PRQualityCheckOut:
    pr = store.pr.get(pr_id)
    if pr is None:
        raise NotFoundError(f"PR {pr_id} not found")

    materials_by_id = {m["id"]: m for m in store.materials.all()}
    lines = [
        {
            "id": line["id"],
            "material_id": line["material_id"],
            "description": line["description"],
            "service_code": line.get("service_code"),
            "material_group": materials_by_id.get(line["material_id"], {}).get("material_group"),
        }
        for line in store.pr_line_items.filter(lambda l: l["pr_id"] == pr_id)
    ]

    result = check_pr_quality(pr["pr_number"], lines)
    return PRQualityCheckOut(
        pr_id=pr["id"],
        pr_number=pr["pr_number"],
        has_issues=result["has_issues"],
        issues=[QualityIssueOut(**i) for i in result["issues"]],
        explanation=result["explanation"],
    )
