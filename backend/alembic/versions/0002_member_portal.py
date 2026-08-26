"""Portal del socio: token de acceso, registro de peso y check-out.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Token de acceso del portal público del socio (60 días, rotable)
    op.add_column(
        "members",
        sa.Column("share_token", sa.String(128), nullable=True),
    )
    op.add_column(
        "members",
        sa.Column("share_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_members_share_token", "members", ["share_token"], unique=True)

    # Check-in / check-out para medir tiempo de entrenamiento
    op.add_column(
        "checkins",
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "checkins",
        sa.Column("duration_min", sa.Integer(), nullable=True),
    )

    # Registro de peso del socio (histórico para la gráfica de progreso)
    op.create_table(
        "member_weight_records",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id"), nullable=False
        ),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column(
            "recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_member_weight_records_member_id", "member_weight_records", ["member_id"])
    op.create_index("ix_member_weight_records_gym_id", "member_weight_records", ["gym_id"])


def downgrade() -> None:
    op.drop_index("ix_member_weight_records_gym_id", table_name="member_weight_records")
    op.drop_index("ix_member_weight_records_member_id", table_name="member_weight_records")
    op.drop_table("member_weight_records")
    op.drop_column("checkins", "duration_min")
    op.drop_column("checkins", "checked_out_at")
    op.drop_index("ix_members_share_token", table_name="members")
    op.drop_column("members", "share_expires_at")
    op.drop_column("members", "share_token")