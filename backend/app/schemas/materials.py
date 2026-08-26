from datetime import datetime

from pydantic import computed_field

from app.schemas.common import ORMBase
from app.services.csv_store import is_repairable_code


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
    reorder_point: int | None = None
    lead_time_days: int
    repair_cost_factor: float | None = None
    active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_repairable(self) -> bool:
        """Derived from the material-code convention, never stored -- so there is exactly
        one place repairability is decided (Initiative 8 SS3.1)."""
        return is_repairable_code(self.material_code)
