"""Initiative 8 -- refurbishable spares tracking.

Read-only over the procurement data, with one exception: completing a condition-to-repair
declaration, which is the single piece of state the platform owns outright.
"""

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.core.exceptions import NotFoundError
from app.schemas.repair import (
    AttestationOut,
    DeclareRequest,
    DuplicateCheckOut,
    EconomicEvaluationOut,
    PendingDeclarationOut,
    RegisterOut,
)
from app.services import attestation_service, repair_register_service, repair_service
from app.services.csv_store import ATTESTATION_STATEMENT, DataStore, Row

router = APIRouter(prefix="/repair", tags=["repair"])


@router.get("/register", response_model=RegisterOut)
def get_register(
    store: DataStore = Depends(get_store),
    plant: str | None = None,
    status: str | None = Query(default=None, description="OVERDUE | IN_FLIGHT | REORDER_TRIGGERED"),
    material_group: str | None = None,
    search: str | None = None,
) -> RegisterOut:
    """Every part currently out for repair, with stock on hand and reorder-point context
    beside it -- so the refurbishment loop is visible wherever stock is considered."""
    return RegisterOut.model_validate(
        repair_register_service.get_register(
            store, plant=plant, status=status, material_group=material_group, search=search
        )
    )


@router.get("/register/plants", response_model=list[str])
def get_register_plants(store: DataStore = Depends(get_store)) -> list[str]:
    return repair_register_service.get_plants(store)


@router.get("/chain-check", response_model=DuplicateCheckOut)
def chain_check(
    material_id: int,
    plant: str | None = None,
    store: DataStore = Depends(get_store),
) -> DuplicateCheckOut:
    """The duplicate guard, called before a new-buy requisition is raised.

    Advisory by design: it reports what is already in flight and what the trade-off looks
    like. It never refuses anything -- see rr_service.create_rr.
    """
    if store.materials.get(material_id) is None:
        raise NotFoundError(f"Material {material_id} not found")

    result = repair_service.check_duplicate(store, material_id, plant)
    result["economics"] = (
        repair_service.economic_evaluation(store, material_id, plant)
        if result["has_active_chain"] else None
    )
    result["attestation_required"] = result["is_repairable"]
    result["attestation_statement"] = ATTESTATION_STATEMENT if result["is_repairable"] else None
    return DuplicateCheckOut.model_validate(result)


@router.get("/economics", response_model=EconomicEvaluationOut)
def economics(
    material_id: int,
    plant: str | None = None,
    store: DataStore = Depends(get_store),
) -> EconomicEvaluationOut:
    result = repair_service.economic_evaluation(store, material_id, plant)
    if result is None:
        raise NotFoundError(f"No active repair chain for material {material_id}")
    return EconomicEvaluationOut.model_validate(result)


@router.get("/attestations", response_model=list[AttestationOut])
def list_attestations(
    store: DataStore = Depends(get_store),
    status: str | None = Query(default=None, description="COMPLETE | PENDING"),
    origin: str | None = Query(default=None, description="MANUAL | MRP | CHAT"),
    plant: str | None = None,
    search: str | None = Query(default=None, description="Requisition, material, or declarer"),
) -> list[AttestationOut]:
    return [
        AttestationOut.model_validate(a)
        for a in attestation_service.build_log(store, status, origin, plant, search)
    ]


@router.get("/attestations/pending", response_model=list[PendingDeclarationOut])
def list_pending_declarations(
    store: DataStore = Depends(get_store),
    plant: str | None = None,
    search: str | None = Query(default=None, description="Requisition, material, or requester"),
) -> list[PendingDeclarationOut]:
    """Auto-raised requisitions blocked at DOA until a planner declares."""
    return [
        PendingDeclarationOut.model_validate(q)
        for q in attestation_service.build_pending_queue(store, plant, search)
    ]


@router.post("/attestations/{attestation_id}/declare", response_model=AttestationOut)
def declare(
    attestation_id: int,
    payload: DeclareRequest | None = None,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> AttestationOut:
    """Complete a pending declaration, unblocking the requisition's approval."""
    attestation_service.complete_pending(
        store, attestation_id, current_user, payload.note if payload else None
    )
    updated = next(
        (a for a in attestation_service.build_log(store) if a["id"] == attestation_id), None
    )
    if updated is None:
        raise NotFoundError(f"Attestation {attestation_id} not found")
    return AttestationOut.model_validate(updated)
