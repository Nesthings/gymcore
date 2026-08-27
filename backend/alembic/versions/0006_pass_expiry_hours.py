"""Vencimiento del pase en horas (12/24/48/72) en lugar de minutos.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "membership_plans",
        sa.Column("pass_expiry_hours", sa.Integer(), nullable=False, server_default="24"),
    )
    op.drop_column("membership_plans", "pass_expiry_minutes")


def downgrade() -> None:
    op.add_column(
        "membership_plans",
        sa.Column("pass_expiry_minutes", sa.Integer(), nullable=False, server_default="30"),
    )
    op.drop_column("membership_plans", "pass_expiry_hours")