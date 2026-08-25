from fastapi import APIRouter, Depends

from app.api.deps import get_store
from app.schemas.situation_analysis import (
    AgingBucketOut,
    DrillDownItemOut,
    RootCauseOut,
    SituationKpiSummaryOut,
    TrendPointOut,
)
from app.services.csv_store import DataStore

router = APIRouter(prefix="/situation-analysis", tags=["situation-analysis"])


@router.get("/aging", response_model=list[AgingBucketOut])
def get_aging(store: DataStore = Depends(get_store)) -> list[AgingBucketOut]:
    buckets = sorted(store.situation_analysis["aging"], key=lambda b: b["sequence_order"])
    return [AgingBucketOut(bucket=b["bucket"], count=b["count"]) for b in buckets]


@router.get("/root-causes", response_model=list[RootCauseOut])
def get_root_causes(store: DataStore = Depends(get_store)) -> list[RootCauseOut]:
    return [
        RootCauseOut(category=r["root_cause_category"], daysLost=r["days_lost"], subCauses=r["sub_causes"], badge=r["badge"])
        for r in store.situation_analysis["root_cause"]
    ]


@router.get("/trend", response_model=list[TrendPointOut])
def get_trend(store: DataStore = Depends(get_store)) -> list[TrendPointOut]:
    return [
        TrendPointOut(month=r["month"], category=r["root_cause_category"], daysLost=r["days_lost"])
        for r in store.situation_analysis["trend"]
    ]


@router.get("/drilldown", response_model=list[DrillDownItemOut])
def get_drilldown(store: DataStore = Depends(get_store)) -> list[DrillDownItemOut]:
    return [
        DrillDownItemOut(
            id=r["pr_po_number"],
            prPoNumber=r["pr_po_number"],
            unit=r["unit"],
            area=r["area"],
            type=r["type"],
            category=r["category"],
            valueZar=r["value_zar"],
            agingBucket=r["aging_bucket"],
            rootCauseCategory=r["root_cause_category"],
            primaryCauseDetail=r["primary_cause_detail"],
            stuckWithPerson=r["stuck_with_person"],
            stuckWithRole=r["stuck_with_role"],
            urgency=r["urgency"],
            sessionId=r["session_id"],
        )
        for r in store.situation_analysis["drilldown"]
    ]


@router.get("/kpi-summary", response_model=SituationKpiSummaryOut)
def get_kpi_summary(store: DataStore = Depends(get_store)) -> SituationKpiSummaryOut:
    buckets = sorted(store.situation_analysis["aging"], key=lambda b: b["sequence_order"])
    total_open_prs = sum(b["count"] for b in buckets)
    over30_index = next((i for i, b in enumerate(buckets) if b["bucket"] == "30-60 days"), 0)
    pr_over_30 = sum(b["count"] for b in buckets[over30_index:])

    po_rows = store.situation_analysis["po_detail"]
    total_open_pos = sum(r["count"] for r in po_rows)
    total_open_po_value = sum(r["value_zar"] for r in po_rows)
    service_po_value = sum(r["value_zar"] for r in po_rows if r["type"] == "Service")

    top_drivers = store.situation_analysis["root_cause"][:2]

    return SituationKpiSummaryOut(
        totalOpenPrs=total_open_prs,
        prOver30=pr_over_30,
        prOver30Pct=round((pr_over_30 / total_open_prs) * 100, 1) if total_open_prs else 0.0,
        totalOpenPos=total_open_pos,
        totalOpenPoValueZar=total_open_po_value,
        servicePoValueZar=service_po_value,
        servicePct=round((service_po_value / total_open_po_value) * 100, 1) if total_open_po_value else 0.0,
        topDrivers=[
            RootCauseOut(category=r["root_cause_category"], daysLost=r["days_lost"], subCauses=r["sub_causes"], badge=r["badge"])
            for r in top_drivers
        ],
    )
