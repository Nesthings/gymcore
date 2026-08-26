"""Modelos de clínicas (tenants) y sucursales."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPkMixin

SUBSCRIPTION_STATUSES = ("trial", "active", "suspended", "cancelled")


class Clinic(UUIDPkMixin, Base):
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(30))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    subscription_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="trial", server_default="trial"
    )
    logo_url: Mapped[str | None] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="UTC", server_default="UTC"
    )
    address: Mapped[str | None] = mapped_column(Text)
    rfc: Mapped[str | None] = mapped_column(String(50))
    fiscal_name: Mapped[str | None] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="MXN", server_default="MXN"
    )
    stock_alert_threshold: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=5, server_default="5"
    )
    birthday_message: Mapped[str | None] = mapped_column(Text)
    birthday_send_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    birthday_send_whatsapp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    whatsapp_phone_number: Mapped[str | None] = mapped_column(String(30))
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(100))
    whatsapp_business_account_id: Mapped[str | None] = mapped_column(String(100))
    whatsapp_access_token: Mapped[str | None] = mapped_column(Text)
    whatsapp_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    whatsapp_reminder_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_birthday_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_receipt_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_receipt_document_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_cartilla_template: Mapped[str | None] = mapped_column(String(100))
    whatsapp_template_language: Mapped[str] = mapped_column(
        String(20), nullable=False, default="es_MX", server_default="es_MX"
    )
    setup_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    branches: Mapped[list["ClinicBranch"]] = relationship(back_populates="clinic")


class ClinicInvite(UUIDPkMixin, Base):
    """Link único del super-admin para que un admin cree su clínica."""

    __tablename__ = "clinic_invites"

    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    clinic_name: Mapped[str | None] = mapped_column(String(200))
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


class ClinicBranch(UUIDPkMixin, Base):
    __tablename__ = "clinic_branches"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    clinic: Mapped[Clinic] = relationship(back_populates="branches")


class ClinicSubscriptionEvent(UUIDPkMixin, Base):
    """Bitácora de eventos de suscripción de una clínica."""

    __tablename__ = "clinic_subscription_events"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
