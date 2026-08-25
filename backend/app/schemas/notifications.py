from datetime import datetime

from app.schemas.common import ORMBase


class NotificationOut(ORMBase):
    id: int
    recipient_id: int
    type: str
    title: str
    message: str
    status: str
    related_entity_type: str | None
    related_entity_id: int | None
    created_at: datetime
    read_at: datetime | None
