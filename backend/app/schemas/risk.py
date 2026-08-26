import uuid
from datetime import datetime

from pydantic import BaseModel


class RiskMemberRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    membership_name: str | None = None
    last_checkin: datetime | None = None
    days_inactive: int
    risk_score: int
    risk_level: str  # critical | warning | info
    attendance_trend: str
    status: str
    renewal_due_days: int | None = None
    suggested_action: str


class RiskSummary(BaseModel):
    total: int
    critical: int
    warning: int
    info: int
