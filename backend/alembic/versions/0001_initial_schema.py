"""GymCore esquema inicial.

Revision ID: 0001
Revises:
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Identidad global del dueño del producto
    op.create_table(
        "super_admins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("photo_url", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    # Tenants
    op.create_table(
        "gyms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("contact_name", sa.String(200)),
        sa.Column("contact_phone", sa.String(30)),
        sa.Column("contact_email", sa.String(200)),
        sa.Column(
            "subscription_status",
            sa.String(20),
            nullable=False,
            server_default="trial",
        ),
        sa.Column("logo_url", sa.String(255)),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("address", sa.Text()),
        sa.Column("currency", sa.String(10), nullable=False, server_default="MXN"),
        sa.Column("whatsapp_phone_number", sa.String(30)),
        sa.Column("whatsapp_phone_number_id", sa.String(100)),
        sa.Column("whatsapp_business_account_id", sa.String(100)),
        sa.Column("whatsapp_access_token", sa.Text()),
        sa.Column("whatsapp_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("whatsapp_receipt_template", sa.String(100)),
        sa.Column("whatsapp_renewal_template", sa.String(100)),
        sa.Column("whatsapp_template_language", sa.String(20), nullable=False, server_default="es_MX"),
        sa.Column("setup_completed", sa.Boolean(), nullable=False, server_default="true"),
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

    op.create_table(
        "gym_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("gym_name", sa.String(200)),
        sa.Column("contact_email", sa.String(200)),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("super_admins.id", ondelete="SET NULL")
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_gym_invites_token", "gym_invites", ["token"])

    op.create_table(
        "gym_branches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("address", sa.Text()),
        sa.Column("phone", sa.String(30)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_gym_branches_gym_id", "gym_branches", ["gym_id"])

    op.create_table(
        "gym_subscription_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_gym_subscription_events_gym_id", "gym_subscription_events", ["gym_id"])

    # Personal
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "branch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gym_branches.id")
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("photo_url", sa.String(255)),
        sa.Column("job_title", sa.String(150)),
        sa.Column("description", sa.Text()),
        sa.Column("reports_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("is_visible_on_login", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_users_gym_id", "users", ["gym_id"])

    op.create_table(
        "user_component_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("component", sa.String(50), nullable=False),
        sa.Column("allowed", sa.Boolean(), nullable=False),
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
    op.create_index("ix_user_component_permissions_user_id", "user_component_permissions", ["user_id"])

    # Socios y membresías
    op.create_table(
        "members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200)),
        sa.Column("phone", sa.String(30)),
        sa.Column("birth_date", sa.Date()),
        sa.Column("gender", sa.String(20)),
        sa.Column("emergency_contact", sa.String(200)),
        sa.Column("emergency_phone", sa.String(30)),
        sa.Column("photo_url", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text()),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
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
    op.create_index("ix_members_gym_id", "members", ["gym_id"])

    op.create_table(
        "membership_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("checkins_limit", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_membership_plans_gym_id", "membership_plans", ["gym_id"])

    op.create_table(
        "member_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("membership_plans.id"),
            nullable=False,
        ),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gym_branches.id")),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("checkins_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paid_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cancel_reason", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_member_memberships_member_id", "member_memberships", ["member_id"])
    op.create_index("ix_member_memberships_plan_id", "member_memberships", ["plan_id"])
    op.create_index("ix_member_memberships_gym_id", "member_memberships", ["gym_id"])

    # Pagos
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id"), nullable=False
        ),
        sa.Column(
            "membership_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("member_memberships.id")
        ),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gym_branches.id")),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("method", sa.String(20), nullable=False, server_default="cash"),
        sa.Column("status", sa.String(20), nullable=False, server_default="paid"),
        sa.Column("concept", sa.String(150)),
        sa.Column("notes", sa.Text()),
        sa.Column("mp_preference_id", sa.String(100)),
        sa.Column("mp_checkout_url", sa.Text()),
        sa.Column("mp_payment_id", sa.String(100)),
        sa.Column("external_ref", sa.String(100)),
        sa.Column(
            "paid_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_payments_gym_id", "payments", ["gym_id"])
    op.create_index("ix_payments_member_id", "payments", ["member_id"])

    # Check-ins
    op.create_table(
        "checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id"), nullable=False
        ),
        sa.Column(
            "membership_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("member_memberships.id")
        ),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gym_branches.id")),
        sa.Column("checked_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "checked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_checkins_gym_id", "checkins", ["gym_id"])
    op.create_index("ix_checkins_member_id", "checkins", ["member_id"])

    # Leads / CRM
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30)),
        sa.Column("email", sa.String(200)),
        sa.Column("source", sa.String(30)),
        sa.Column("status", sa.String(20), nullable=False, server_default="nuevo"),
        sa.Column("value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text()),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "converted_member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id")
        ),
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
    op.create_index("ix_leads_gym_id", "leads", ["gym_id"])

    # Alertas inteligentes
    op.create_table(
        "smart_alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id")),
        sa.Column("rule_key", sa.String(50), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("message_template", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("params", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    op.create_table(
        "smart_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gym_branches.id")),
        sa.Column("rule_key", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=False, server_default="member"),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "triggered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "last_evaluated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("metadata_json", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("message", sa.Text()),
        sa.Column("link", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_smart_alerts_gym_id", "smart_alerts", ["gym_id"])
    op.create_index("ix_smart_alerts_entity_id", "smart_alerts", ["entity_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_smart_alerts_active
        ON smart_alerts (gym_id, rule_key, entity_type, entity_id)
        WHERE status = 'active'
        """
    )

    # Notificaciones
    op.create_table(
        "outbound_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id")),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("template", sa.String(200)),
        sa.Column("recipient", sa.String(30)),
        sa.Column("external_id", sa.String(100)),
        sa.Column("error", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False, server_default="sent"),
        sa.Column(
            "sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_outbound_notifications_gym_id", "outbound_notifications", ["gym_id"])

    op.create_table(
        "internal_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link", sa.Text()),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_internal_notifications_gym_id", "internal_notifications", ["gym_id"])
    op.create_index("ix_internal_notifications_user_id", "internal_notifications", ["user_id"])

    # Auditoría
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id")),
        sa.Column("actor_type", sa.String(10), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_audit_log_gym_id", "audit_log", ["gym_id"])

    # Recuperación de contraseña
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("token", sa.String(128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_table("audit_log")
    op.drop_index("ix_internal_notifications_user_id", table_name="internal_notifications")
    op.drop_index("ix_internal_notifications_gym_id", table_name="internal_notifications")
    op.drop_table("internal_notifications")
    op.drop_index("ix_outbound_notifications_gym_id", table_name="outbound_notifications")
    op.drop_table("outbound_notifications")
    op.execute("DROP INDEX IF EXISTS uq_smart_alerts_active")
    op.drop_index("ix_smart_alerts_entity_id", table_name="smart_alerts")
    op.drop_index("ix_smart_alerts_gym_id", table_name="smart_alerts")
    op.drop_table("smart_alerts")
    op.drop_table("smart_alert_rules")
    op.drop_index("ix_leads_gym_id", table_name="leads")
    op.drop_table("leads")
    op.drop_index("ix_checkins_member_id", table_name="checkins")
    op.drop_index("ix_checkins_gym_id", table_name="checkins")
    op.drop_table("checkins")
    op.drop_index("ix_payments_member_id", table_name="payments")
    op.drop_index("ix_payments_gym_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_member_memberships_gym_id", table_name="member_memberships")
    op.drop_index("ix_member_memberships_plan_id", table_name="member_memberships")
    op.drop_index("ix_member_memberships_member_id", table_name="member_memberships")
    op.drop_table("member_memberships")
    op.drop_index("ix_membership_plans_gym_id", table_name="membership_plans")
    op.drop_table("membership_plans")
    op.drop_index("ix_members_gym_id", table_name="members")
    op.drop_table("members")
    op.drop_index("ix_user_component_permissions_user_id", table_name="user_component_permissions")
    op.drop_table("user_component_permissions")
    op.drop_index("ix_users_gym_id", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_gym_subscription_events_gym_id", table_name="gym_subscription_events")
    op.drop_table("gym_subscription_events")
    op.drop_index("ix_gym_branches_gym_id", table_name="gym_branches")
    op.drop_table("gym_branches")
    op.drop_index("ix_gym_invites_token", table_name="gym_invites")
    op.drop_table("gym_invites")
    op.drop_table("gyms")
    op.drop_table("super_admins")