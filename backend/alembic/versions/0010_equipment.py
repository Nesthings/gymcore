"""Módulo Layout: catálogo de equipos, assets, mantenimiento, incidencias y plano.

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equipment_categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_table(
        "equipment_types",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("equipment_categories.id"), nullable=False, index=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("gym_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
    )
    op.create_table(
        "equipment_brands",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
    )
    op.create_table(
        "equipment_models",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("brand_id", sa.Uuid(), sa.ForeignKey("equipment_brands.id"), nullable=False, index=True),
        sa.Column("type_id", sa.Uuid(), sa.ForeignKey("equipment_types.id"), nullable=False, index=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("width_m", sa.Float(), nullable=True),
        sa.Column("depth_m", sa.Float(), nullable=True),
        sa.Column("height_m", sa.Float(), nullable=True),
        sa.Column("image_url", sa.String(255), nullable=True),
        sa.Column("manual_url", sa.String(255), nullable=True),
        sa.Column("maintenance_guide_url", sa.String(255), nullable=True),
        sa.Column("gym_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("is_global", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "equipment_model_maintenance_recommendations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("equipment_model_id", sa.Uuid(), sa.ForeignKey("equipment_models.id"), nullable=False, index=True),
        sa.Column("task", sa.String(120), nullable=False),
        sa.Column("task_type", sa.String(40), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("frequency", sa.String(40), nullable=False, server_default="custom"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("manufacturer_recommended", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("source_document", sa.String(255), nullable=True),
    )
    op.create_table(
        "equipment_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("gym_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("branch_id", sa.Uuid(), sa.ForeignKey("gym_branches.id"), nullable=True),
        sa.Column("zone_id", sa.Uuid(), nullable=True),
        sa.Column("equipment_model_id", sa.Uuid(), sa.ForeignKey("equipment_models.id"), nullable=True),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("equipment_categories.id"), nullable=True, index=True),
        sa.Column("type_id", sa.Uuid(), sa.ForeignKey("equipment_types.id"), nullable=True, index=True),
        sa.Column("brand_id", sa.Uuid(), sa.ForeignKey("equipment_brands.id"), nullable=True),
        sa.Column("category_name", sa.String(80), nullable=True),
        sa.Column("type_name", sa.String(80), nullable=True),
        sa.Column("brand_name", sa.String(120), nullable=True),
        sa.Column("model_name", sa.String(120), nullable=True),
        sa.Column("custom_name", sa.String(120), nullable=True),
        sa.Column("asset_number", sa.String(80), nullable=True),
        sa.Column("serial_number", sa.String(120), nullable=True),
        sa.Column("position_x", sa.Float(), nullable=False, server_default="0"),
        sa.Column("position_y", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rotation", sa.Float(), nullable=False, server_default="0"),
        sa.Column("width_m", sa.Float(), nullable=True),
        sa.Column("depth_m", sa.Float(), nullable=True),
        sa.Column("height_m", sa.Float(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="operativo"),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "maintenance_tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("gym_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("equipment_asset_id", sa.Uuid(), sa.ForeignKey("equipment_assets.id"), nullable=False, index=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("task_type", sa.String(40), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("frequency", sa.String(40), nullable=False, server_default="custom"),
        sa.Column("last_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("manufacturer_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("source_document", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "maintenance_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("gym_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("equipment_asset_id", sa.Uuid(), sa.ForeignKey("equipment_assets.id"), nullable=False, index=True),
        sa.Column("maintenance_task_id", sa.Uuid(), sa.ForeignKey("maintenance_tasks.id"), nullable=True),
        sa.Column("task_name", sa.String(120), nullable=False),
        sa.Column("task_type", sa.String(40), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_by", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("replaced_parts", sa.JSON(), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=True),
    )
    op.create_table(
        "equipment_incidents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("gym_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("equipment_asset_id", sa.Uuid(), sa.ForeignKey("equipment_assets.id"), nullable=False, index=True),
        sa.Column("category", sa.String(40), nullable=False, server_default="otro"),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("took_out_of_service", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
    )
    op.create_table(
        "gym_layouts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("gym_id", sa.Uuid(), nullable=False, unique=True, index=True),
        sa.Column("width_m", sa.Float(), nullable=False, server_default="30"),
        sa.Column("length_m", sa.Float(), nullable=False, server_default="18"),
        sa.Column("notice_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("zones", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for t in (
        "gym_layouts",
        "equipment_incidents",
        "maintenance_records",
        "maintenance_tasks",
        "equipment_assets",
        "equipment_model_maintenance_recommendations",
        "equipment_models",
        "equipment_brands",
        "equipment_types",
        "equipment_categories",
    ):
        op.drop_table(t)