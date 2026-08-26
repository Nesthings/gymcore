import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    type: str
    message: str
    link: str | None
    read_at: datetime | None
    created_at: datetime


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID | None
    actor_type: str
    actor_id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    metadata_json: dict | None
    created_at: datetime
