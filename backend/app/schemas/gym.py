import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GymUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=30)
    contact_email: str | None = Field(default=None, max_length=200)
    timezone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    currency: str | None = Field(default=None, max_length=10)
    whatsapp_phone_number: str | None = Field(default=None, max_length=30)
    whatsapp_enabled: bool | None = None
    setup_completed: bool | None = None


class GymRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    subscription_status: str
    logo_url: str | None = None
    timezone: str
    address: str | None = None
    currency: str
    whatsapp_phone_number: str | None = None
    whatsapp_enabled: bool
    setup_completed: bool
    created_at: datetime


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=30)


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=30)


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    name: str
    address: str | None = None
    phone: str | None = None
    created_at: datetime


class CreateGymRequest(BaseModel):
    invite_token: str
    name: str = Field(min_length=1, max_length=200)
    admin_name: str = Field(min_length=1, max_length=200)
    admin_email: str = Field(min_length=3, max_length=200)
    admin_password: str = Field(min_length=8, max_length=128)


class CreateGymResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    sub: str
    gym_id: str
