"""Modelo de leads (CRM / pipeline de ventas)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin

LEAD_STATUSES = ("nuevo", "contactado", "propuesta", "ganado", "perdido")
LEAD_SOURCES = ("instagram", "facebook", "referido", "whatsapp", "walkin", "google", "otro")


class Lead(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "leads"

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    source: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="nuevo", server_default="nuevo"
    )
    value: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0, server_default="0"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    converted_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
