import uuid
from datetime import datetime

from pydantic import BaseModel


class CheckinRequest(BaseModel):
    member_id: uuid.UUID | None = None
    qr_token: str | None = None


class CheckinResult(BaseModel):
    ok: bool
    message: str
    member_id: uuid.UUID | None = None
    member_name: str | None = None
    plan_active: bool | None = None


class TodayCheckinRead(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    branch_name: str | None = None
    checked_at: datetime
