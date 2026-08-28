import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SaleItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class SaleCreate(BaseModel):
    branch_id: uuid.UUID | None = None
    payment_method: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)
    items: list[SaleItemCreate] = Field(min_length=1)


class SaleItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID | None
    name: str
    quantity: int
    unit_price: float
    line_total: float


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    total: float
    status: str
    payment_method: str | None
    notes: str | None
    created_at: datetime
    items: list[SaleItemRead] = []


class SaleResult(BaseModel):
    id: uuid.UUID
    total: float
    item_count: int
