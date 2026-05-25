"""
Adiciona campos de faturamento posterior à tabela empresas.

Campos:
  - faturamento_posterior: flag que indica cobrança consolidada mensal
  - dia_faturamento: dia do mês para corte/cobrança (1-31)
  - valor_por_consulta: valor unitário cobrado por consulta
  - valor_por_aso: valor unitário cobrado por ASO emitido
  - observacoes_faturamento: anotações sobre acordo de faturamento
"""

from alembic import op
import sqlalchemy as sa

revision = "add_company_billing_fields"
down_revision = "exames_smart_search"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "empresas",
        sa.Column(
            "faturamento_posterior",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "empresas",
        sa.Column("dia_faturamento", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "empresas",
        sa.Column("valor_por_consulta", sa.Float(), nullable=True),
    )
    op.add_column(
        "empresas",
        sa.Column("valor_por_aso", sa.Float(), nullable=True),
    )
    op.add_column(
        "empresas",
        sa.Column("observacoes_faturamento", sa.Text(), nullable=True),
    )

    op.create_index(
        "ix_empresas_faturamento_posterior",
        "empresas",
        ["faturamento_posterior"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_empresas_faturamento_posterior", table_name="empresas")
    op.drop_column("empresas", "observacoes_faturamento")
    op.drop_column("empresas", "valor_por_aso")
    op.drop_column("empresas", "valor_por_consulta")
    op.drop_column("empresas", "dia_faturamento")
    op.drop_column("empresas", "faturamento_posterior")
