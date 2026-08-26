"""Modelo de pases del socio (invitación con token de un solo uso)."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin

PASS_STATUSES = ("available", "generated", "redeemed", "expired", "cancelled")
PASS_TYPES = ("invitado", "dia", "clase")


class MemberPass(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "member_passes"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pass_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="invitado", server_default="invitado"
    )
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="available", server_default="available"
    )
    guest_name: Mapped[str | None] = mapped_column(String(200))
    guest_phone: Mapped[str | None] = mapped_column(String(30))
    guest_email: Mapped[str | None] = mapped_column(String(200))
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    redeemed_lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id")
    )
    period_start: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
