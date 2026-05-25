"""add audit columns to exames and convenios

Revision ID: 31b9fdda2545
Revises: 4184da689105
Create Date: 2026-01-25 16:22:06.470265

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "31b9fdda2545"
down_revision = "4184da689105"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Return True if column exists in the given table (public schema)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = inspector.get_columns(table, schema="public")
    return any(c["name"] == column for c in cols)


def _add_column_if_missing(table: str, col: sa.Column) -> None:
    """Add column only if it doesn't exist yet."""
    if not _column_exists(table, col.name):
        op.add_column(table, col)


def _ensure_audit_columns(table: str) -> None:
    """
    Ensure audit columns exist:
      - created_at
      - updated_at
      - created_by_id
      - updated_by_id
    """
    _add_column_if_missing(
        table, sa.Column("created_at", sa.DateTime(), nullable=True)
    )
    _add_column_if_missing(
        table, sa.Column("updated_at", sa.DateTime(), nullable=True)
    )
    _add_column_if_missing(
        table, sa.Column("created_by_id", sa.BigInteger(), nullable=True)
    )
    _add_column_if_missing(
        table, sa.Column("updated_by_id", sa.BigInteger(), nullable=True)
    )


def upgrade():
    # Tabelas que já estão sendo acessadas pelos endpoints e models (AuditableMixin)
    for table in ("exames", "convenios", "solicitacoes_de_exames"):
        _ensure_audit_columns(table)


def downgrade():
    # Downgrade opcional: remover as colunas (se existirem).
    # Mantido defensivo também, pra não quebrar.
    for table in ("solicitacoes_de_exames", "convenios", "exames"):
        if _column_exists(table, "updated_by_id"):
            op.drop_column(table, "updated_by_id")
        if _column_exists(table, "created_by_id"):
            op.drop_column(table, "created_by_id")
        if _column_exists(table, "updated_at"):
            op.drop_column(table, "updated_at")
        if _column_exists(table, "created_at"):
            op.drop_column(table, "created_at")

