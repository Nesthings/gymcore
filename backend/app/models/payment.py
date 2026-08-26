"""Modelo de pagos (cobranza)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin

PAYMENT_METHODS = ("cash", "card", "transfer", "mercadopago")
PAYMENT_STATUSES = ("pending", "paid", "failed", "refunded")


class Payment(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "payments"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id"), nullable=False, index=True
    )
    membership_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("member_memberships.id")
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gym_branches.id")
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(20), nullable=False, default="cash")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="paid", server_default="paid"
    )
    concept: Mapped[str | None] = mapped_column(String(150))
    notes: Mapped[str | None] = mapped_column(Text)
    # Integración Mercado Pago
    mp_preference_id: Mapped[str | None] = mapped_column(String(100))
    mp_checkout_url: Mapped[str | None] = mapped_column(Text)
    mp_payment_id: Mapped[str | None] = mapped_column(String(100))
    external_ref: Mapped[str | None] = mapped_column(String(100))
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    member: Mapped["Member"] = relationship(back_populates="payments")  # noqa: F821
