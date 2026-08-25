from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.schemas.analytics import BottlenecksOut, CycleTimeOut, DashboardSummaryOut, OpenPrPoOut
from app.services import analytics_service
from app.services.csv_store import DataStore

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cycle-time", response_model=CycleTimeOut)
def cycle_time(store: DataStore = Depends(get_store)) -> CycleTimeOut:
    return CycleTimeOut(**analytics_service.get_cycle_time(store))


@router.get("/bottlenecks", response_model=BottlenecksOut)
def bottlenecks(store: DataStore = Depends(get_store)) -> BottlenecksOut:
    return BottlenecksOut(**analytics_service.get_bottlenecks(store))


@router.get("/open-pr-po", response_model=OpenPrPoOut)
def open_pr_po(
    store: DataStore = Depends(get_store),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> OpenPrPoOut:
    return OpenPrPoOut(**analytics_service.get_open_pr_po(store, page, page_size))


@router.get("/dashboard-summary", response_model=DashboardSummaryOut)
def dashboard_summary(store: DataStore = Depends(get_store)) -> DashboardSummaryOut:
    return DashboardSummaryOut(**analytics_service.get_dashboard_summary(store))
