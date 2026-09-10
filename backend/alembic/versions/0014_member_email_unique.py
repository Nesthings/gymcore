"""Índice único de email de socio por gimnasio (evita duplicados y races).

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Limpia duplicados previos (se queda con el más reciente por (gym,email)).
    op.execute(
        "DELETE FROM members m USING members dup "
        "WHERE dup.gym_id = m.gym_id AND dup.email = m.email AND dup.email IS NOT NULL "
        "AND dup.created_at > m.created_at"
    )
    op.create_index(
        "uq_members_gym_email",
        "members",
        ["gym_id", "email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_members_gym_email", table_name="members")