from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "4184da689105"
down_revision = "merge_all_heads"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        return column in [c["name"] for c in inspector.get_columns(table)]
    except Exception:
        return False


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    if not _column_exists(table, column.name):
        op.add_column(table, column)


def upgrade():
    # Tabelas onde o app espera audit + timestamps
    core_tables = ["empresas", "pagamentos", "agendamentos", "pacientes"]

    for table in core_tables:
        _add_column_if_missing(table, sa.Column("created_at", sa.DateTime(), nullable=True))
        _add_column_if_missing(table, sa.Column("updated_at", sa.DateTime(), nullable=True))
        _add_column_if_missing(table, sa.Column("created_by_id", sa.BigInteger(), nullable=True))
        _add_column_if_missing(table, sa.Column("updated_by_id", sa.BigInteger(), nullable=True))

    # consultas: você já tem created_at/updated_at no banco, mas NÃO tem created_by_id/updated_by_id
    _add_column_if_missing("consultas", sa.Column("created_by_id", sa.BigInteger(), nullable=True))
    _add_column_if_missing("consultas", sa.Column("updated_by_id", sa.BigInteger(), nullable=True))


def downgrade():
    pass

