"""Modelos de membresías: planes y membresías de socios."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin

MEMBERSHIP_STATUSES = ("active", "expiring", "expired", "cancelled")


class MembershipPlan(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "membership_plans"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    checkins_limit: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Política de pases del plan (0 = sin pases)
    pass_quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    pass_period: Mapped[str | None] = mapped_column(String(10))  # week | month
    pass_type: Mapped[str | None] = mapped_column(String(20))  # invitado | dia | clase
    pass_duration_days: Mapped[int | None] = mapped_column(Integer)  # 1 | 3
    pass_requires_guest: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    pass_ask_phone: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    pass_ask_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    pass_max_accumulate: Mapped[int | None] = mapped_column(Integer)
    pass_expiry_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=24, server_default="24"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MemberMembership(GymScopedMixin, UUIDPkMixin, Base):
    """Membresía (contrato) de un socio con un plan."""

    __tablename__ = "member_memberships"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("membership_plans.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gym_branches.id")
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    checkins_used: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    paid_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0, server_default="0"
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    member: Mapped["Member"] = relationship(back_populates="memberships")  # noqa: F821
    plan: Mapped[MembershipPlan] = relationship()
