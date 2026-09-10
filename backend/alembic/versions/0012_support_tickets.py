"""Tickets de soporte (reportes de problemas del staff atendidos por el super-admin).

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reporter_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reporter_name", sa.String(200), nullable=False),
        sa.Column("reporter_email", sa.String(200), nullable=False),
        sa.Column("gym_id", sa.Uuid(), sa.ForeignKey("gyms.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolved_by", sa.Uuid(), sa.ForeignKey("super_admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "support_ticket_attachments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("ticket_id", sa.Uuid(), sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_type", sa.String(20), nullable=False, server_default="file"),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("support_ticket_attachments")
    op.drop_table("support_tickets")