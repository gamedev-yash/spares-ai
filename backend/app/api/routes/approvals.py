from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.schemas.approvals import ApprovalActionRequest, ApprovalOut
from app.schemas.common import Page
from app.services import approval_service
from app.services.csv_store import DataStore, Row

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _hydrate(store: DataStore, approvals: list[Row]) -> list[ApprovalOut]:
    rr_by_id = {rr["id"]: rr for rr in store.rr.all()}
    users_by_id = {u["id"]: u for u in store.users.all()}
    first_lines = {
        line["rr_id"]: line["material_id"]
        for line in store.rr_line_items.filter(lambda l: l["line_number"] == 1)
    }
    materials_by_id = {m["id"]: m for m in store.materials.all()}

    out: list[ApprovalOut] = []
    for a in approvals:
        rr = rr_by_id.get(a["rr_id"]) if a.get("rr_id") else None
        requester = users_by_id.get(rr["requester_id"]) if rr else None
        material_id = first_lines.get(a["rr_id"]) if a.get("rr_id") else None
        material = materials_by_id.get(material_id) if material_id else None
        out.append(
            ApprovalOut(
                **{k: a.get(k) for k in ApprovalOut.model_fields if k not in ("rr_number", "requester_name", "material_description", "total_value")},
                rr_number=rr["rr_number"] if rr else None,
                requester_name=requester["name"] if requester else None,
                material_description=material["description"] if material else None,
                total_value=float(rr["total_estimated_value"]) if rr else None,
            )
        )
    return out


@router.get("", response_model=Page[ApprovalOut])
def list_approvals(
    store: DataStore = Depends(get_store),
    status: str | None = "PENDING",
    urgency: str | None = None,
    approval_type: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> Page[ApprovalOut]:
    items = store.approvals.all()
    if status:
        items = [a for a in items if a.get("status") == status]
    if urgency:
        items = [a for a in items if a.get("urgency") == urgency]
    if approval_type:
        items = [a for a in items if a.get("approval_type") == approval_type]

    items = sorted(items, key=lambda a: a.get("submitted_at") or "")
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return Page(items=_hydrate(store, page_items), total=total, page=page, page_size=page_size)


@router.post("/{approval_id}/approve", response_model=ApprovalOut)
def approve_approval(
    approval_id: int,
    payload: ApprovalActionRequest = ApprovalActionRequest(),
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> ApprovalOut:
    approval = approval_service.approve(store, approval_id, current_user, payload.comments)
    return _hydrate(store, [approval])[0]


@router.post("/{approval_id}/reject", response_model=ApprovalOut)
def reject_approval(
    approval_id: int,
    payload: ApprovalActionRequest = ApprovalActionRequest(),
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> ApprovalOut:
    approval = approval_service.reject(store, approval_id, current_user, payload.comments)
    return _hydrate(store, [approval])[0]


@router.post("/{approval_id}/escalate", response_model=ApprovalOut)
def escalate_approval(
    approval_id: int,
    payload: ApprovalActionRequest = ApprovalActionRequest(),
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> ApprovalOut:
    approval = approval_service.escalate(store, approval_id, current_user, payload.comments)
    return _hydrate(store, [approval])[0]
