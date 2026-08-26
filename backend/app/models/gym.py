"""Modelos de gimnasios (tenants) y sucursales."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPkMixin

SUBSCRIPTION_STATUSES = ("trial", "active", "suspended", "cancelled")


class Gym(UUIDPkMixin, Base):
    __tablename__ = "gyms"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(30))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    subscription_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="trial", server_default="trial"
    )
    logo_url: Mapped[str | None] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="America/Mexico_City", server_default="UTC"
    )
    address: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="MXN", server_default="MXN"
    )
    whatsapp_phone_number: Mapped[str | None] = mapped_column(String(30))
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(100))
    whatsapp_business_account_id: Mapped[str | None] = mapped_column(String(100))
    whatsapp_access_token: Mapped[str | None] = mapped_column(Text)
    whatsapp_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    whatsapp_receipt_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_renewal_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_template_language: Mapped[str] = mapped_column(
        String(20), nullable=False, default="es_MX", server_default="es_MX"
    )
    setup_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # Racha con protección: N días de descanso no rompen la racha del socio
    streak_grace_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # Umbral de stock para marcar "stock bajo" en el módulo de productos
    stock_alert_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=5, server_default="5"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    branches: Mapped[list["GymBranch"]] = relationship(back_populates="gym")


class GymInvite(UUIDPkMixin, Base):
    """Link único del super-admin para que un admin cree su gimnasio."""

    __tablename__ = "gym_invites"

    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    gym_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("super_admins.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class GymBranch(UUIDPkMixin, Base):
    __tablename__ = "gym_branches"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    gym: Mapped[Gym] = relationship(back_populates="branches")


class GymSubscriptionEvent(UUIDPkMixin, Base):
    """Bitácora de eventos de suscripción de un gimnasio."""

    __tablename__ = "gym_subscription_events"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gyms.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
