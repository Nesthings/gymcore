"""Elimina la integración con Mercado Pago (pasarela cancelada).

Remueve las columnas mp_* de payments, reasigna los pagos que usaban
mercadopago como método a transfer y actualiza el enum en el código.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Los pagos que se habían iniciado por Mercado Pago quedan como transfer
    # (sin pasarela ya no hay pagos pendientes de confirmación externa).
    op.execute("UPDATE payments SET method = 'transfer' WHERE method = 'mercadopago'")
    op.drop_column("payments", "mp_payment_id")
    op.drop_column("payments", "mp_checkout_url")
    op.drop_column("payments", "mp_preference_id")


def downgrade() -> None:
    op.add_column("payments", sa.Column("mp_preference_id", sa.String(100), nullable=True))
    op.add_column("payments", sa.Column("mp_checkout_url", sa.Text(), nullable=True))
    op.add_column("payments", sa.Column("mp_payment_id", sa.String(100), nullable=True))