import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

LEAD_STATUS_VALUES = ("nuevo", "contacto", "propuesta", "ganado", "perdido")


class LeadCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, pattern="^(nuevo|contacto|propuesta|ganado|perdido)$")
    value: float = Field(default=0, ge=0)
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class LeadUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=30)
    status: str | None = Field(default=None, pattern="^(nuevo|contacto|propuesta|ganado|perdido)$")
    value: float | None = Field(default=None, ge=0)
    notes: str | None = None
    assigned_to: uuid.UUID | None = None


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    status: str
    value: float
    notes: str | None = None
    assigned_to: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class LeadPipelineStat(BaseModel):
    status: str
    count: int
    value: float


class LeadPipelineResponse(BaseModel):
    pipeline: list[LeadPipelineStat]
