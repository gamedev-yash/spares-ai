from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.schemas.approvals import ApprovalActionRequest, ApprovalOut
from app.schemas.common import Page
from app.services import approval_service
from app.services.csv_store import ATTESTATION_STATUS_PENDING, DataStore, Row

router = APIRouter(prefix="/approvals", tags=["approvals"])


DERIVED_APPROVAL_FIELDS = (
    "rr_number", "requester_name", "material_description", "total_value",
    "duplicate_flag", "duplicate_context", "attestation", "attestation_pending",
)


def _hydrate(store: DataStore, approvals: list[Row]) -> list[ApprovalOut]:
    rr_by_id = {rr["id"]: rr for rr in store.rr.all()}
    users_by_id = {u["id"]: u for u in store.users.all()}
    first_lines = {
        line["rr_id"]: line["material_id"]
        for line in store.rr_line_items.filter(lambda l: l["line_number"] == 1)
    }
    materials_by_id = {m["id"]: m for m in store.materials.all()}

    # Initiative 8 SS3.3: the approver alert carries the duplicate context AND the
    # requisitioner's declaration, so the approval decision is made with both in view.
    # Joined here rather than copied onto the approval row -- the RR remains the record.
    attestations_by_rr: dict[int, list[Row]] = {}
    for row in store.attestations.all():
        attestations_by_rr.setdefault(row.get("rr_id"), []).append(row)

    out: list[ApprovalOut] = []
    for a in approvals:
        rr = rr_by_id.get(a["rr_id"]) if a.get("rr_id") else None
        requester = users_by_id.get(rr["requester_id"]) if rr else None
        material_id = first_lines.get(a["rr_id"]) if a.get("rr_id") else None
        material = materials_by_id.get(material_id) if material_id else None

        rr_attestations = attestations_by_rr.get(a.get("rr_id"), [])
        pending = [x for x in rr_attestations if x.get("status") == ATTESTATION_STATUS_PENDING]
        declared = next((x for x in rr_attestations if x.get("status") != ATTESTATION_STATUS_PENDING), None)

        attestation_summary = None
        if rr_attestations:
            source = declared or rr_attestations[0]
            declarer = users_by_id.get(source.get("declared_by"))
            attestation_summary = {
                "id": source["id"],
                "status": source.get("status"),
                "origin": source.get("origin"),
                "statement": source.get("statement"),
                "declared_by_name": declarer.get("name") if declarer else None,
                "declared_at": source.get("declared_at"),
            }

        out.append(
            ApprovalOut(
                **{k: a.get(k) for k in ApprovalOut.model_fields if k not in DERIVED_APPROVAL_FIELDS},
                rr_number=rr["rr_number"] if rr else None,
                requester_name=requester["name"] if requester else None,
                material_description=material["description"] if material else None,
                total_value=float(rr["total_estimated_value"]) if rr else None,
                duplicate_flag=bool(rr.get("duplicate_flag")) if rr else False,
                duplicate_context=rr.get("duplicate_context") if rr else None,
                attestation=attestation_summary,
                attestation_pending=bool(pending),
            )
        )
    return out


def _matches(row: ApprovalOut, needle: str) -> bool:
    haystack = " ".join(
        str(v or "")
        for v in (
            row.rr_number, row.requester_name, row.material_description,
            row.approver_role, row.approval_type, row.urgency,
        )
    )
    return needle in haystack.lower()


@router.get("", response_model=Page[ApprovalOut])
def list_approvals(
    store: DataStore = Depends(get_store),
    status: str | None = "PENDING",
    urgency: str | None = None,
    approval_type: str | None = None,
    search: str | None = None,
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

    needle = (search or "").strip().lower()
    if not needle:
        # Fast path -- only hydrate the page being returned.
        total = len(items)
        start = (page - 1) * page_size
        return Page(
            items=_hydrate(store, items[start : start + page_size]),
            total=total, page=page, page_size=page_size,
        )

    # Search spans joined fields (requisition number, requester, material), so the rows have
    # to be hydrated before they can be matched -- and matched before paging, or the count
    # and the pages would both be wrong.
    hydrated = [row for row in _hydrate(store, items) if _matches(row, needle)]
    total = len(hydrated)
    start = (page - 1) * page_size
    return Page(items=hydrated[start : start + page_size], total=total, page=page, page_size=page_size)


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
