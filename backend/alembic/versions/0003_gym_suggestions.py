"""Buzón de sugerencias: comentarios de los socios hacia el gimnasio.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gym_suggestions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id"), nullable=True
        ),
        sa.Column("member_name", sa.String(200)),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_gym_suggestions_gym_id", "gym_suggestions", ["gym_id"])
    op.create_index("ix_gym_suggestions_member_id", "gym_suggestions", ["member_id"])


def downgrade() -> None:
    op.drop_index("ix_gym_suggestions_member_id", table_name="gym_suggestions")
    op.drop_index("ix_gym_suggestions_gym_id", table_name="gym_suggestions")
    op.drop_table("gym_suggestions")