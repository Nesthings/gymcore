"""Esquemas de los tickets de soporte."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SupportTicketCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)


class SupportTicketAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_type: str
    url: str
    created_at: datetime


class SupportTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reporter_name: str
    reporter_email: str
    gym_id: uuid.UUID | None = None
    subject: str
    description: str
    status: str
    resolution_notes: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    gym_name: str | None = None
    attachments: list[SupportTicketAttachmentRead] = []