"""Salas múltiples en el módulo Layout.

Añade room_id a equipment_assets (NULL = sala principal) y rooms a gym_layouts.

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "equipment_assets",
        sa.Column("room_id", sa.Uuid(), nullable=True, index=True),
    )
    op.add_column("gym_layouts", sa.Column("rooms", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("gym_layouts", "rooms")
    op.drop_column("equipment_assets", "room_id")