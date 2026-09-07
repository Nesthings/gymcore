"""Añade columnas TOTP (2FA) a super_admins y users.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-06
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("super_admins", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column(
        "super_admins",
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column("users", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
    op.drop_column("super_admins", "totp_enabled")
    op.drop_column("super_admins", "totp_secret")