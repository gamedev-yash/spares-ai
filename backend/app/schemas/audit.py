from datetime import datetime
from typing import Any

from app.schemas.common import ORMBase


class AuditLogOut(ORMBase):
    id: int
    user_id: int | None
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    timestamp: datetime
    ip_address: str | None
