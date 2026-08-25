from collections import OrderedDict

from fastapi import APIRouter, Depends

from app.api.deps import get_store
from app.services import dashboard_service
from app.schemas.vzi import (
    VziAgingBucketOut,
    VziCategoryPivotRow,
    VziCategoryRow,
    VziDashboardOut,
    VziFlagOut,
    VziKpiSummaryOut,
    VziOarVbAggregate,
    VziOarVbRow,
    VziPoAreaRow,
    VziPoDetailRow,
    VziPrSummaryRow,
    VziTotals,
    VziUnitAggregate,
)
from app.services.csv_store import DataStore

router = APIRouter(prefix="/vzi", tags=["vzi"])


@router.get("/dashboard", response_model=VziDashboardOut)
def get_vzi_dashboard(store: DataStore = Depends(get_store)) -> VziDashboardOut:
    ref = dashboard_service.get_vzi_dashboard(store)
    pr_summary_rows = ref["pr_summary"]
    po_summary_rows = ref["po_summary"]
    aging_rows = ref["aging"]
    oar_vb_rows = ref["oar_vb"]
    category_rows = ref["categories"]
    po_detail_rows = ref["po_detail"]
    care = ref["care_maintenance"]
    flags = ref["flags"]

    pr_material = sum(r["material"] for r in pr_summary_rows)
    pr_service = sum(r["service"] for r in pr_summary_rows)
    po_material = sum(r["material"] for r in po_summary_rows)
    po_service = sum(r["service"] for r in po_summary_rows)
    po_value_material = round(sum(r["matValue"] for r in po_detail_rows), 2)
    po_value_service = round(sum(r["svcValue"] for r in po_detail_rows), 2)
    po_value_total = round(po_value_material + po_value_service, 2)

    aging_total = sum(r["count"] for r in aging_rows)
    pr_over_30 = sum(r["count"] for r in aging_rows[3:])

    oar_vb_by_unit: "OrderedDict[str, VziOarVbAggregate]" = OrderedDict()
    for r in oar_vb_rows:
        agg = oar_vb_by_unit.setdefault(r["unit"], VziOarVbAggregate(oar=0, vb=0, total=0))
        agg.oar += r["oar"]
        agg.vb += r["vb"]
    for agg in oar_vb_by_unit.values():
        agg.total = agg.oar + agg.vb

    po_by_unit: "OrderedDict[str, VziUnitAggregate]" = OrderedDict()
    for r in po_detail_rows:
        agg = po_by_unit.setdefault(r["unit"], VziUnitAggregate(matCount=0, matValue=0, svcCount=0, svcValue=0, count=0, value=0))
        agg.matCount += r["matCount"]
        agg.matValue += r["matValue"]
        agg.svcCount += r["svcCount"]
        agg.svcValue += r["svcValue"]
    for agg in po_by_unit.values():
        agg.matValue = round(agg.matValue, 2)
        agg.svcValue = round(agg.svcValue, 2)
        agg.count = agg.matCount + agg.svcCount
        agg.value = round(agg.matValue + agg.svcValue, 2)

    category_order: list[str] = []
    category_agg: dict[str, dict] = {}
    for r in category_rows:
        if r["category"] not in category_agg:
            category_agg[r["category"]] = {"category": r["category"], "Gamsberg": 0, "BMM": 0}
            category_order.append(r["category"])
        category_agg[r["category"]][r["unit"]] += r["count"]
    category_pivot = sorted(
        (VziCategoryPivotRow(**category_agg[c], total=category_agg[c]["Gamsberg"] + category_agg[c]["BMM"]) for c in category_order),
        key=lambda row: row.total,
        reverse=True,
    )

    po_area_sorted = sorted(
        (
            VziPoAreaRow(
                unit=r["unit"], area=r["area"], matCount=r["matCount"], matValue=r["matValue"],
                svcCount=r["svcCount"], svcValue=r["svcValue"],
                label=f"{r['unit']} - {r['area']}",
                total=round(r["matValue"] + r["svcValue"], 2),
            )
            for r in po_detail_rows
        ),
        key=lambda row: row.total,
        reverse=True,
    )

    kpi_summary = VziKpiSummaryOut(
        openPr=VziTotals(material=pr_material, service=pr_service, total=pr_material + pr_service),
        openPo=VziTotals(material=po_material, service=po_service, total=po_material + po_service),
        openPoValue=VziTotals(material=po_value_material, service=po_value_service, total=po_value_total),
        servicePct=round((po_value_service / po_value_total) * 100, 1) if po_value_total else 0.0,
        agingTotal=aging_total,
        prOver30=pr_over_30,
        prOver30Pct=round((pr_over_30 / aging_total) * 100, 1) if aging_total else 0.0,
        careMaintenance=VziTotals(material=care["material"], service=care["service"], total=care["total"]),
    )

    return VziDashboardOut(
        kpiSummary=kpi_summary,
        prSummary=[VziPrSummaryRow(unit=r["unit"], material=r["material"], service=r["service"]) for r in pr_summary_rows],
        aging=[VziAgingBucketOut(bucket=r["bucket"], count=r["count"]) for r in aging_rows],
        oarVb=[VziOarVbRow(unit=r["unit"], area=r["area"], oar=r["oar"], vb=r["vb"]) for r in oar_vb_rows],
        oarVbByUnit=oar_vb_by_unit,
        categories=[VziCategoryRow(unit=r["unit"], area=r["area"], category=r["category"], count=r["count"]) for r in category_rows],
        categoryPivot=category_pivot,
        poSummary=[VziPrSummaryRow(unit=r["unit"], material=r["material"], service=r["service"]) for r in po_summary_rows],
        poDetail=[VziPoDetailRow(unit=r["unit"], area=r["area"], matCount=r["matCount"], matValue=r["matValue"], svcCount=r["svcCount"], svcValue=r["svcValue"]) for r in po_detail_rows],
        poByUnit=po_by_unit,
        poAreaSorted=po_area_sorted,
        slideNotes=ref["slide_notes"],
        derivedNotes=ref["derived_notes"],
        flags=[VziFlagOut(title=f["title"], body=f["body"]) for f in flags],
    )
