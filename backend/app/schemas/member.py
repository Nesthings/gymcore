import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    emergency_contact: str | None = Field(default=None, max_length=200)
    emergency_phone: str | None = Field(default=None, max_length=30)
    notes: str | None = None


class MemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    emergency_contact: str | None = Field(default=None, max_length=200)
    emergency_phone: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, pattern="^(active|inactive|cancelled)$")
    notes: str | None = None


class MemberMembershipSummary(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    plan_name: str
    status: str
    starts_at: datetime
    expires_at: datetime
    checkins_used: int
    checkins_limit: int | None = None
    paid_amount: float


class MemberRead(BaseModel):
    id: uuid.UUID
    gym_id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    photo_url: str | None = None
    status: str
    joined_at: datetime
    risk_level: str | None = None
    risk_score: int | None = None
    membership: MemberMembershipSummary | None = None


class MemberDetail(BaseModel):
    id: uuid.UUID
    gym_id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    photo_url: str | None = None
    status: str
    notes: str | None = None
    joined_at: datetime
    memberships: list[MemberMembershipSummary]
    payments: list["PaymentSummary"]
    checkins: list["CheckinSummary"]
    risk_level: str | None = None
    risk_score: int | None = None
    risk_suggested_action: str | None = None
    last_checkin_at: datetime | None = None


class PaymentSummary(BaseModel):
    id: uuid.UUID
    amount: float
    method: str
    status: str
    concept: str | None = None
    paid_at: datetime


class CheckinSummary(BaseModel):
    id: uuid.UUID
    checked_at: datetime
    branch_name: str | None = None
