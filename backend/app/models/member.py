"""Modelo de socios del gimnasio."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin

MEMBER_STATUSES = ("active", "inactive", "cancelled")


class Member(GymScopedMixin, UUIDPkMixin, Base):
    __tablename__ = "members"

    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30))
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    emergency_contact: Mapped[str | None] = mapped_column(String(200))
    emergency_phone: Mapped[str | None] = mapped_column(String(30))
    photo_url: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    # Acceso al portal público del socio (token rotable, 60 días)
    share_token: Mapped[str | None] = mapped_column(String(128), unique=True, index=True)
    share_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    memberships: Mapped[list["MemberMembership"]] = relationship(  # noqa: F821
        back_populates="member"
    )
    payments: Mapped[list["Payment"]] = relationship(  # noqa: F821
        back_populates="member"
    )
    checkins: Mapped[list["Checkin"]] = relationship(  # noqa: F821
        back_populates="member"
    )
