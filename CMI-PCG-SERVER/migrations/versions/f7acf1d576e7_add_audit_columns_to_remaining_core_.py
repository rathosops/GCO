"""add audit columns to remaining core tables

Revision ID: f7acf1d576e7
Revises: 31b9fdda2545
Create Date: 2026-01-25 16:26:09.489013

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f7acf1d576e7"
down_revision = "31b9fdda2545"
branch_labels = None
depends_on = None


AUDIT_COLS = (
    ("created_at", sa.DateTime(), True),
    ("updated_at", sa.DateTime(), True),
    ("created_by_id", sa.BigInteger(), True),
    ("updated_by_id", sa.BigInteger(), True),
)


def _inspector():
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str, schema: str = "public") -> bool:
    insp = _inspector()
    return table_name in insp.get_table_names(schema=schema)


def _column_exists(table_name: str, column_name: str, schema: str = "public") -> bool:
    insp = _inspector()
    cols = insp.get_columns(table_name, schema=schema)
    return any(c["name"] == column_name for c in cols)


def _add_audit_columns(table_name: str) -> None:
    # Não falhar se a tabela não existir (ex: ambientes antigos)
    if not _table_exists(table_name):
        return

    for col_name, col_type, nullable in AUDIT_COLS:
        if not _column_exists(table_name, col_name):
            op.add_column(table_name, sa.Column(col_name, col_type, nullable=nullable))


def _drop_audit_columns(table_name: str) -> None:
    if not _table_exists(table_name):
        return

    # drop em ordem inversa
    for col_name, _, _ in reversed(AUDIT_COLS):
        if _column_exists(table_name, col_name):
            op.drop_column(table_name, col_name)


def upgrade():
    # ✅ Core que você validou no psql (e que davam erro antes)
    targets = [
        "empresas",
        "pagamentos",
        "agendamentos",
        "pacientes",
    ]

    # ✅ Outras tabelas core típicas do projeto (seguro por ser idempotente)
    more_targets = [
        "medicos",
        "procedimentos",
        "consultas",
        "solicitacoes_de_asos",
        "chamadas",
        "salas_chamadas",
        "triagem_imesc",
        "usuarios_chamadas",
        "atendentes",
        "enfermeiros",
        "riscos",
        "clinica_infos",
        "exames_clinica",
        "autenticadores",
        "background_music_config",
        "background_music_tracks",
    ]

    for t in targets + more_targets:
        _add_audit_columns(t)


def downgrade():
    targets = [
        "background_music_tracks",
        "background_music_config",
        "autenticadores",
        "exames_clinica",
        "clinica_infos",
        "riscos",
        "enfermeiros",
        "atendentes",
        "usuarios_chamadas",
        "triagem_imesc",
        "salas_chamadas",
        "chamadas",
        "solicitacoes_de_asos",
        "consultas",
        "procedimentos",
        "medicos",
        "pacientes",
        "agendamentos",
        "pagamentos",
        "empresas",
    ]

    for t in targets:
        _drop_audit_columns(t)

