"""Tickets de soporte para todos los roles.

reporter_user_id pasa a ser nullable (super-admin vive en super_admins) y se
agrega reporter_role para distinguir reportes de la plataforma vs. del staff.

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("support_tickets", "reporter_user_id", nullable=True)
    op.add_column(
        "support_tickets",
        sa.Column("reporter_role", sa.String(30), nullable=False, server_default="staff"),
    )


def downgrade() -> None:
    op.drop_column("support_tickets", "reporter_role")
    op.alter_column("support_tickets", "reporter_user_id", nullable=False)