from pydantic import BaseModel

# Field names intentionally match the frontend's existing camelCase contract
# (src/lib/types.ts) so the situation-analysis pages can swap their data source
# from the CSV loader to this API with no shape changes.


class AgingBucketOut(BaseModel):
    bucket: str
    count: int


class RootCauseOut(BaseModel):
    category: str
    daysLost: float
    subCauses: list[str]
    badge: str | None = None


class TrendPointOut(BaseModel):
    month: str
    category: str
    daysLost: float


class DrillDownItemOut(BaseModel):
    id: str
    prPoNumber: str
    unit: str
    area: str
    type: str
    category: str
    valueZar: float
    agingBucket: str
    rootCauseCategory: str
    primaryCauseDetail: str
    stuckWithPerson: str
    stuckWithRole: str
    urgency: str
    sessionId: str | None = None


class SituationKpiSummaryOut(BaseModel):
    totalOpenPrs: int
    prOver30: int
    prOver30Pct: float
    totalOpenPos: int
    totalOpenPoValueZar: float
    servicePoValueZar: float
    servicePct: float
    topDrivers: list[RootCauseOut]
