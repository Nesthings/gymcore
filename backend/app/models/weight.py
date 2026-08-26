"""Modelo de registros de peso del socio (histórico para gráfica de progreso)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin


class MemberWeightRecord(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "member_weight_records"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id"), nullable=False, index=True
    )
    weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
