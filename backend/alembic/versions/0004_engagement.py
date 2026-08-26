"""Engagement del socio: logros, objetivos, feed, pases y racha con gracia.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Racha con días de gracia configurable por gimnasio
    op.add_column(
        "gyms",
        sa.Column("streak_grace_days", sa.Integer(), nullable=False, server_default="0"),
    )

    # Política de pases por plan de membresía
    op.add_column(
        "membership_plans",
        sa.Column("pass_quantity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("membership_plans", sa.Column("pass_period", sa.String(10)))
    op.add_column("membership_plans", sa.Column("pass_type", sa.String(20)))
    op.add_column("membership_plans", sa.Column("pass_duration_days", sa.Integer()))
    op.add_column(
        "membership_plans",
        sa.Column("pass_requires_guest", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "membership_plans",
        sa.Column("pass_ask_phone", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "membership_plans",
        sa.Column("pass_ask_email", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("membership_plans", sa.Column("pass_max_accumulate", sa.Integer()))
    op.add_column(
        "membership_plans",
        sa.Column("pass_expiry_minutes", sa.Integer(), nullable=False, server_default="30"),
    )

    # Objetivos personales del socio
    op.create_table(
        "member_goals",
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
        sa.Column("goal_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(150)),
        sa.Column("target_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_member_goals_member_id", "member_goals", ["member_id"])
    op.create_index("ix_member_goals_gym_id", "member_goals", ["gym_id"])

    # Feed de novedades del gimnasio
    op.create_table(
        "gym_posts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_gym_posts_gym_id", "gym_posts", ["gym_id"])

    # Pases del socio (generación y redención)
    op.create_table(
        "member_passes",
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
        sa.Column("pass_type", sa.String(20), nullable=False, server_default="invitado"),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("guest_name", sa.String(200)),
        sa.Column("guest_phone", sa.String(30)),
        sa.Column("guest_email", sa.String(200)),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("redeemed_at", sa.DateTime(timezone=True)),
        sa.Column("redeemed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("redeemed_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id")),
        sa.Column("period_start", sa.Date()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_member_passes_member_id", "member_passes", ["member_id"])
    op.create_index("ix_member_passes_gym_id", "member_passes", ["gym_id"])
    op.create_index("ix_member_passes_token", "member_passes", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_member_passes_token", table_name="member_passes")
    op.drop_index("ix_member_passes_gym_id", table_name="member_passes")
    op.drop_index("ix_member_passes_member_id", table_name="member_passes")
    op.drop_table("member_passes")
    op.drop_index("ix_gym_posts_gym_id", table_name="gym_posts")
    op.drop_table("gym_posts")
    op.drop_index("ix_member_goals_gym_id", table_name="member_goals")
    op.drop_index("ix_member_goals_member_id", table_name="member_goals")
    op.drop_table("member_goals")
    op.drop_column("membership_plans", "pass_expiry_minutes")
    op.drop_column("membership_plans", "pass_max_accumulate")
    op.drop_column("membership_plans", "pass_ask_email")
    op.drop_column("membership_plans", "pass_ask_phone")
    op.drop_column("membership_plans", "pass_requires_guest")
    op.drop_column("membership_plans", "pass_duration_days")
    op.drop_column("membership_plans", "pass_type")
    op.drop_column("membership_plans", "pass_period")
    op.drop_column("membership_plans", "pass_quantity")
    op.drop_column("gyms", "streak_grace_days")