"""Tickets de soporte — reportes de problemas hechos por el staff del gimnasio.

Un ticket lo crea un usuario del gimnasio (staff) desde el panel de la app y lo
atiende el super-admin (dueño del producto) desde el panel de plataforma.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPkMixin


class SupportTicket(UUIDPkMixin, Base):
    """Reporte de un problema del usuario del gimnasio o de la plataforma."""

    __tablename__ = "support_tickets"

    # Para staff apunta a users.id; para super-admin es NULL (vive en super_admins)
    reporter_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reporter_role: Mapped[str] = mapped_column(
        String(30), nullable=False, default="staff", server_default="staff"
    )
    # Snapshot del autor para que el ticket siga mostrando quién lo emitió
    # aunque el usuario se desactive o cambie su nombre.
    reporter_name: Mapped[str] = mapped_column(String(200), nullable=False)
    reporter_email: Mapped[str] = mapped_column(String(200), nullable=False)
    gym_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gyms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("super_admins.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SupportTicketAttachment(UUIDPkMixin, Base):
    """Archivo adjunto de un ticket (del reporte inicial o de la resolución)."""

    __tablename__ = "support_ticket_attachments"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    file_type: Mapped[str] = mapped_column(String(20), nullable=False, default="file")
    url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )