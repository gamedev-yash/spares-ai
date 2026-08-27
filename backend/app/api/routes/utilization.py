from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_store
from app.core.exceptions import NotFoundError
from app.schemas.common import Page
from app.schemas.utilization import (
    ConfirmConsumedRequest,
    ConsumptionPlanCreate,
    ConsumptionPlanResult,
    ExceptionOut,
    RedeploymentDecisionRequest,
    RedeploymentRecommendationOut,
    ReleaseRequest,
    ReplanRequest,
    UnmatchedIssueOut,
    UnmatchedIssueResolveRequest,
    UnusedStockOut,
    UtilizationDetailOut,
    UtilizationRecordOut,
)
from app.services import utilization_service as svc
from app.services.csv_store import DataStore, Row

router = APIRouter(prefix="/utilization", tags=["utilization"])


@router.get("/classify")
def classify(material_id: int, store: DataStore = Depends(get_store)):
    material = store.materials.get(material_id)
    if material is None:
        raise NotFoundError(f"Material {material_id} not found")
    classification, reason = svc.classify_material(material)
    return {"material_id": material_id, "classification": classification, "reason": reason}


@router.get("/risk")
def risk(material_id: int, plant: str, department: str, quantity: float = 1, store: DataStore = Depends(get_store), current_user: Row = Depends(get_current_user)):
    material = store.materials.get(material_id)
    if material is None:
        raise NotFoundError(f"Material {material_id} not found")
    return svc.assess_risk(store, material, plant, department, quantity, current_user["id"])


@router.get("/stock-check")
def stock_check(material_id: int, plant: str, quantity: float = 1, store: DataStore = Depends(get_store)):
    material = store.materials.get(material_id)
    if material is None:
        raise NotFoundError(f"Material {material_id} not found")
    return svc.stock_check(store, material, plant, quantity)


@router.post("/consumption-plans", response_model=ConsumptionPlanResult)
def post_consumption_plan(
    payload: ConsumptionPlanCreate,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> ConsumptionPlanResult:
    result = svc.create_consumption_plan(store, current_user, payload, source_system="manual")
    return ConsumptionPlanResult(**result)


@router.get("", response_model=Page[UtilizationRecordOut])
def list_utilization(
    plant: str | None = None,
    department: str | None = None,
    requester_id: int | None = None,
    stage: str | None = None,
    risk_level: str | None = None,
    aging_severity: str | None = None,
    mine_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> Page[UtilizationRecordOut]:
    result = svc.list_utilization(
        store, plant=plant, department=department, requester_id=requester_id, stage=stage,
        risk_level=risk_level, aging_severity=aging_severity,
        mine_only_user=current_user if mine_only else None, page=page, page_size=page_size,
    )
    return Page(items=[UtilizationRecordOut(**r) for r in result["items"]], total=result["total"], page=page, page_size=page_size)


@router.get("/exceptions", response_model=Page[ExceptionOut])
def list_exceptions(
    plant: str | None = None,
    department: str | None = None,
    requester_id: int | None = None,
    type: str | None = None,
    severity: str | None = None,
    status: str | None = "OPEN",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    store: DataStore = Depends(get_store),
) -> Page[ExceptionOut]:
    result = svc.list_exceptions(
        store, plant=plant, department=department, requester_id=requester_id,
        exc_type=type, severity=severity, status=status, page=page, page_size=page_size,
    )
    return Page(items=[ExceptionOut(**e) for e in result["items"]], total=result["total"], page=page, page_size=page_size)


@router.post("/exceptions/{exception_id}/resolve", response_model=ExceptionOut)
def resolve_exception(exception_id: int, note: str | None = None, store: DataStore = Depends(get_store), current_user: Row = Depends(get_current_user)) -> ExceptionOut:
    return ExceptionOut(**svc.resolve_exception(store, current_user, exception_id, note))


@router.get("/redeployment/recommendations", response_model=list[RedeploymentRecommendationOut])
def list_redeployment_recommendations(decision: str | None = None, plant: str | None = None, store: DataStore = Depends(get_store)) -> list[RedeploymentRecommendationOut]:
    return [RedeploymentRecommendationOut(**r) for r in svc.list_redeployment_recommendations(store, decision=decision, plant=plant)]


@router.post("/redeployment/{recommendation_id}/decision", response_model=RedeploymentRecommendationOut)
def decide_redeployment(
    recommendation_id: int,
    payload: RedeploymentDecisionRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> RedeploymentRecommendationOut:
    return RedeploymentRecommendationOut(**svc.decide_redeployment(store, current_user, recommendation_id, payload.decision))


@router.get("/unused-stock", response_model=list[UnusedStockOut])
def list_unused_stock(plant: str | None = None, status: str | None = "AVAILABLE", store: DataStore = Depends(get_store)) -> list[UnusedStockOut]:
    return [UnusedStockOut(**r) for r in svc.list_unused_stock(store, plant=plant, status=status)]


@router.get("/unmatched-issues", response_model=list[UnmatchedIssueOut])
def list_unmatched_issues(status: str | None = "PENDING", store: DataStore = Depends(get_store)) -> list[UnmatchedIssueOut]:
    return [UnmatchedIssueOut(**r) for r in svc.list_unmatched_issues(store, status=status)]


@router.post("/unmatched-issues/{issue_id}/resolve", response_model=UnmatchedIssueOut)
def resolve_unmatched_issue(
    issue_id: int,
    payload: UnmatchedIssueResolveRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> UnmatchedIssueOut:
    return UnmatchedIssueOut(**svc.resolve_unmatched_issue(store, current_user, issue_id, payload.action))


@router.get("/dashboard")
def get_dashboard(store: DataStore = Depends(get_store)) -> dict:
    return svc.get_dashboard(store)


@router.get("/{record_id}", response_model=UtilizationDetailOut)
def get_utilization_detail(record_id: int, store: DataStore = Depends(get_store)) -> UtilizationDetailOut:
    return UtilizationDetailOut(**svc.get_utilization_detail(store, record_id))


@router.post("/{record_id}/confirm-consumed", response_model=UtilizationDetailOut)
def post_confirm_consumed(
    record_id: int,
    payload: ConfirmConsumedRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> UtilizationDetailOut:
    return UtilizationDetailOut(**svc.confirm_consumed(store, current_user, record_id, payload.actual_date, payload.comment))


@router.post("/{record_id}/replan", response_model=UtilizationDetailOut)
def post_replan(
    record_id: int,
    payload: ReplanRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> UtilizationDetailOut:
    return UtilizationDetailOut(**svc.replan(store, current_user, record_id, payload.new_planned_date, payload.reason))


@router.post("/{record_id}/release", response_model=UtilizationDetailOut)
def post_release(
    record_id: int,
    payload: ReleaseRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> UtilizationDetailOut:
    return UtilizationDetailOut(**svc.release(store, current_user, record_id, payload.reason))
