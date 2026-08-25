from pydantic import BaseModel

# Field names mirror the frontend's existing VZI_* / Vzi*() contract (src/lib/types.ts,
# src/lib/mock-data.ts) so /dashboard can swap its data source with minimal page changes.


class VziTotals(BaseModel):
    material: float
    service: float
    total: float


class VziPrSummaryRow(BaseModel):
    unit: str
    material: int
    service: int


class VziAgingBucketOut(BaseModel):
    bucket: str
    count: int


class VziOarVbRow(BaseModel):
    unit: str
    area: str
    oar: int
    vb: int


class VziOarVbAggregate(BaseModel):
    oar: int
    vb: int
    total: int


class VziCategoryRow(BaseModel):
    unit: str
    area: str
    category: str
    count: int


class VziCategoryPivotRow(BaseModel):
    category: str
    Gamsberg: int
    BMM: int
    total: int


class VziPoDetailRow(BaseModel):
    unit: str
    area: str
    matCount: int
    matValue: float
    svcCount: int
    svcValue: float


class VziUnitAggregate(BaseModel):
    matCount: int
    matValue: float
    svcCount: int
    svcValue: float
    count: int
    value: float


class VziPoAreaRow(VziPoDetailRow):
    label: str
    total: float


class VziFlagOut(BaseModel):
    title: str
    body: str


class VziKpiSummaryOut(BaseModel):
    openPr: VziTotals
    openPo: VziTotals
    openPoValue: VziTotals
    servicePct: float
    agingTotal: int
    prOver30: int
    prOver30Pct: float
    careMaintenance: VziTotals


class VziDashboardOut(BaseModel):
    kpiSummary: VziKpiSummaryOut
    prSummary: list[VziPrSummaryRow]
    aging: list[VziAgingBucketOut]
    oarVb: list[VziOarVbRow]
    oarVbByUnit: dict[str, VziOarVbAggregate]
    categories: list[VziCategoryRow]
    categoryPivot: list[VziCategoryPivotRow]
    poSummary: list[VziPrSummaryRow]
    poDetail: list[VziPoDetailRow]
    poByUnit: dict[str, VziUnitAggregate]
    poAreaSorted: list[VziPoAreaRow]
    slideNotes: list[str]
    derivedNotes: list[str]
    flags: list[VziFlagOut]
