"""Modelos de notificaciones (salientes e internas)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPkMixin


class OutboundNotification(UUIDPkMixin, Base):
    """Registro de una notificación saliente (whatsapp/email/sms).

    Sin proveedor configurado todavía, el motor de recordatorios registra aquí
    sus envíos con status 'sent' (stub). El template codifica el recordatorio y
    la entidad: `renew:<member_membership_id>` para deduplicar.
    """

    __tablename__ = "outbound_notifications"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id")
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    template: Mapped[str | None] = mapped_column(String(200))
    recipient: Mapped[str | None] = mapped_column(String(30))
    external_id: Mapped[str | None] = mapped_column(String(100))
    error: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="sent", server_default="sent"
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class InternalNotification(UUIDPkMixin, Base):
    """Notificación interna dirigida a un usuario del staff."""

    __tablename__ = "internal_notifications"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
