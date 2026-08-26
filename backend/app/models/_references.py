"""Tablas Core referenciadas por FKs sin modelo ORM propio."""

from sqlalchemy import Boolean, Column, DateTime, String, Table, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base

super_admins = Table(
    "super_admins",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("email", String(200), nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("full_name", String(200), nullable=False),
    Column("photo_url", String(255)),
    Column("is_active", Boolean, nullable=False, server_default="true"),
    Column("last_login_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)
