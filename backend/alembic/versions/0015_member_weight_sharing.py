"""Opt-in del socio para compartir su peso con el gimnasio.

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "share_weight",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "share_weight")
