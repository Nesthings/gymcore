import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MembershipPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    price: float = Field(gt=0)
    duration_days: int = Field(gt=0, le=3660)
    checkins_limit: int | None = Field(default=None, gt=0)
    is_active: bool = True


class MembershipPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    duration_days: int | None = Field(default=None, gt=0, le=3660)
    checkins_limit: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


class MembershipPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    name: str
    description: str | None = None
    price: float
    duration_days: int
    checkins_limit: int | None = None
    is_active: bool


class AssignMembershipRequest(BaseModel):
    plan_id: uuid.UUID
    start_date: datetime | None = None
    paid_amount: float | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, pattern="^(cash|card|transfer|mercadopago)$")
    branch_id: uuid.UUID | None = None


class ActiveMembershipRead(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    plan_id: uuid.UUID
    plan_name: str
    status: str
    starts_at: datetime
    expires_at: datetime
    checkins_used: int
    checkins_limit: int | None = None
    paid_amount: float


class RenewMembershipRequest(BaseModel):
    amount: float | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, pattern="^(cash|card|transfer|mercadopago)$")


class CancelMembershipRequest(BaseModel):
    reason: str | None = None
