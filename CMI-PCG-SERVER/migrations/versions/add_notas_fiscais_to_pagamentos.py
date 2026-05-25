# migrations/versions/add_nota_fiscal_to_pagamentos.py
"""Add nota fiscal fields to pagamentos

Revision ID: add_nota_fiscal_pagamentos
Revises: add_feriados_customizados
Create Date: 2026-02-04
"""
from alembic import op
import sqlalchemy as sa


revision = "add_nota_fiscal_pagamentos"
down_revision = "add_feriados_customizados"
branch_labels = None
depends_on = None


def upgrade():
    """Adiciona campos de nota fiscal à tabela pagamentos."""
    op.add_column(
        "pagamentos",
        sa.Column(
            "vinculado_nota_fiscal", sa.Boolean(), nullable=True, server_default="false"
        ),
    )
    op.add_column(
        "pagamentos", sa.Column("numero_nota_fiscal", sa.String(50), nullable=True)
    )


def downgrade():
    """Remove campos de nota fiscal da tabela pagamentos."""
    op.drop_column("pagamentos", "numero_nota_fiscal")
    op.drop_column("pagamentos", "vinculado_nota_fiscal")
