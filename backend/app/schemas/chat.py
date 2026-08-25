from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMBase


class ChatOptionOut(BaseModel):
    id: str
    label: str
    description: str | None = None


class ChatMessageOut(ORMBase):
    id: int
    role: str
    text: str
    options: list[dict[str, Any]] | None
    created_at: datetime


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str | None = None
    option_id: str | None = None


class ChatResponse(BaseModel):
    session_id: int
    session_title: str
    message: ChatMessageOut
    demo_mode: bool


class ChatSessionSummaryOut(ORMBase):
    id: int
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
