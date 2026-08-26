import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

STAFF_ROLE_VALUES = ("admin", "recepcion", "coach")


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(pattern="^(admin|recepcion|coach)$")
    phone: str | None = Field(default=None, max_length=30)
    branch_id: uuid.UUID | None = None
    job_title: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    reports_to: uuid.UUID | None = None
    is_visible_on_login: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, min_length=3, max_length=200)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: str | None = Field(default=None, pattern="^(admin|recepcion|coach)$")
    phone: str | None = Field(default=None, max_length=30)
    branch_id: uuid.UUID | None = None
    is_active: bool | None = None
    job_title: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    reports_to: uuid.UUID | None = None
    is_visible_on_login: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    branch_id: uuid.UUID | None
    role: str
    full_name: str
    email: str
    phone: str | None
    photo_url: str | None = None
    job_title: str | None = None
    description: str | None = None
    reports_to: uuid.UUID | None = None
    last_login_at: datetime | None = None
    is_visible_on_login: bool = True
    is_active: bool
    created_at: datetime
    branch_name: str | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    current_password: str | None = Field(default=None)
    new_password: str | None = Field(default=None, min_length=8, max_length=128)
