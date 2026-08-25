from datetime import datetime

from app.schemas.common import ORMBase


class MaterialOut(ORMBase):
    id: int
    material_code: str
    description: str
    material_group: str
    material_type: str
    plant: str
    storage_location: str
    unit_of_measure: str
    criticality: str
    lifecycle_status: str
    service_code: str | None
    manufacturer: str | None
    manufacturer_part_no: str | None
    last_po_price: float | None
    last_vendor: str | None
    stock_level: int
    lead_time_days: int
    active: bool
    created_at: datetime
    updated_at: datetime
