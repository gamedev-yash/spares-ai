from pydantic import BaseModel


class CycleTimeTrendPoint(BaseModel):
    month: str
    average_days: float
    count: int


class CycleTimeOut(BaseModel):
    sample_size: int
    average_days: float | None
    median_days: float | None
    p90_days: float | None
    p95_days: float | None
    stage_wise_avg_days: dict[str, float]
    bottleneck_stage: str | None
    trend: list[CycleTimeTrendPoint]


class BottleneckStageOut(BaseModel):
    stage_code: str
    average_duration_days: float
    transaction_count: int
    delayed_transaction_count: int
    delayed_pct: float
    pct_contribution_to_total_delay: float


class BottlenecksOut(BaseModel):
    stages: list[BottleneckStageOut]


class OpenItemOut(BaseModel):
    type: str
    number: str
    status: str
    current_stage: str
    owner: str | None
    days_open: int
    value: float


class OpenPrPoOut(BaseModel):
    items: list[OpenItemOut]
    total: int
    page: int
    page_size: int
    open_pr_count: int
    open_po_count: int
    open_pr_value: float
    open_po_value: float


class DashboardSummaryOut(BaseModel):
    open_pr_count: int
    open_po_count: int
    open_pr_value: float
    open_po_value: float
    average_cycle_time_days: float | None
    bottleneck_stage: str | None
    prs_over_30_days: int
    top_bottleneck_stages: list[BottleneckStageOut]
