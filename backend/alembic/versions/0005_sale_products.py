"""Catálogo de productos de venta (módulo "Productos").

El gimnasio vende productos retail (suplementos, ropa, accesorios, snacks…).
El admin registra el producto con nombre, categoría, precio opcional y una foto
opcional, con existencia simple (unidades disponibles). También se agrega el
umbral de alerta de stock por gimnasio.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "gyms",
        sa.Column("stock_alert_threshold", sa.Integer(), nullable=False, server_default="5"),
    )

    op.create_table(
        "sale_products",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("price", sa.Numeric(10, 2)),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("photo_url", sa.Text()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_sale_products_gym_id", "sale_products", ["gym_id"])
    op.create_index("ix_sale_products_category", "sale_products", ["category"])


def downgrade() -> None:
    op.drop_index("ix_sale_products_category", table_name="sale_products")
    op.drop_index("ix_sale_products_gym_id", table_name="sale_products")
    op.drop_table("sale_products")
    op.drop_column("gyms", "stock_alert_threshold")