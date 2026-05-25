"""add tipo_pessoa_pix to pagamentos

Revision ID: 5edbcd6edcce
Revises: 386d349370c4
Create Date: 2026-01-13 08:36:31.936615
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5edbcd6edcce"
down_revision = "386d349370c4"
branch_labels = None
depends_on = None


# ============================================================
# Helper
# ============================================================


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        return column in [c["name"] for c in inspector.get_columns(table)]
    except Exception:
        return False


# ============================================================
# Upgrade
# ============================================================


def upgrade():
    # Adiciona a coluna apenas se ainda não existir
    if not _column_exists("pagamentos", "tipo_pessoa_pix"):
        op.add_column(
            "pagamentos",
            sa.Column("tipo_pessoa_pix", sa.String(length=2), nullable=True),
        )


# ============================================================
# Downgrade
# ============================================================


def downgrade():
    # Remove a coluna apenas se existir
    if _column_exists("pagamentos", "tipo_pessoa_pix"):
        op.drop_column("pagamentos", "tipo_pessoa_pix")
