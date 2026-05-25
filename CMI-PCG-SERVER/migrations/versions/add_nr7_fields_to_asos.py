# migrations/versions/add_nr7_fields_to_asos.py
"""Add NR-7 fields to solicitacoes_de_asos

Revision ID: add_nr7_fields_asos
Revises: add_nota_fiscal_pagamentos
Create Date: 2026-02-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "add_nr7_fields_asos"
down_revision = "add_nota_fiscal_pagamentos"
branch_labels = None
depends_on = None


def _col_exists(table, column):
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def _idx_exists(table, index):
    bind = op.get_bind()
    insp = inspect(bind)
    indexes = [i["name"] for i in insp.get_indexes(table)]
    return index in indexes


TABLE = "solicitacoes_de_asos"

NEW_COLUMNS = [
    sa.Column("tipo_exame", sa.String(30), nullable=False, server_default="ADMISSIONAL"),
    sa.Column("funcao_paciente", sa.String(200), nullable=False, server_default="Não informado"),
    sa.Column("setor", sa.String(200), nullable=True),
    sa.Column("conclusao", sa.String(30), nullable=False, server_default="APTO"),
    sa.Column("restricoes", sa.Text(), nullable=True),
    sa.Column("riscos_ocupacionais", sa.JSON(), nullable=True),
    sa.Column("exames_complementares", sa.JSON(), nullable=True),
    sa.Column("normas_regulamentadoras", sa.JSON(), nullable=True),
    sa.Column("manipulacao_alimentos", sa.String(30), nullable=True),
    sa.Column("observacoes", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    sa.Column("created_by", sa.String(100), nullable=True),
]

NEW_INDEXES = [
    ("ix_asos_cpf_paciente", ["cpf_paciente"]),
    ("ix_asos_cnpj_empresa", ["cnpj_empresa"]),
    ("ix_asos_crm_medico", ["crm_medico"]),
]


def upgrade():
    for col in NEW_COLUMNS:
        if not _col_exists(TABLE, col.name):
            op.add_column(TABLE, col)

    for idx_name, idx_cols in NEW_INDEXES:
        if not _idx_exists(TABLE, idx_name):
            op.create_index(idx_name, TABLE, idx_cols)


def downgrade():
    for idx_name, _ in NEW_INDEXES:
        if _idx_exists(TABLE, idx_name):
            op.drop_index(idx_name, table_name=TABLE)

    for col in reversed(NEW_COLUMNS):
        if _col_exists(TABLE, col.name):
            op.drop_column(TABLE, col.name)
