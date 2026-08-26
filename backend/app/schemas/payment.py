import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    member_id: uuid.UUID
    amount: float = Field(gt=0)
    method: str = Field(pattern="^(cash|card|transfer|mercadopago)$")
    concept: str | None = Field(default=None, max_length=150)
    notes: str | None = None
    paid_at: datetime | None = None


class PaymentRead(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    amount: float
    method: str
    status: str
    concept: str | None = None
    notes: str | None = None
    mp_checkout_url: str | None = None
    external_ref: str | None = None
    paid_at: datetime
    created_at: datetime


class MercadoPagoInitResponse(BaseModel):
    payment_id: uuid.UUID
    init_point: str
    external_ref: str
