"""add expenses table

Cria tabela de despesas para controle financeiro completo:
- Categorias: PESSOAL, MATERIAIS_INSUMOS, ALUGUEL_INFRAESTRUTURA, etc.
- Classificação fixo/variável com centros de custo
- Status de pagamento, recorrência e vínculo com fornecedores
- Índices compostos para queries de analytics

Revision ID: add_expenses_table
Revises: add_aso_questionarios
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa

revision = "add_expenses_table"
down_revision = "add_aso_questionarios"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "despesas",
        # PK
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        # Descrição
        sa.Column("descricao", sa.String(500), nullable=False),
        sa.Column("observacoes", sa.Text(), nullable=True),
        # Classificação
        sa.Column("categoria", sa.String(50), nullable=False),
        sa.Column(
            "tipo_custo", sa.String(10),
            nullable=False, server_default="FIXO",
        ),
        sa.Column("centro_custo", sa.String(50), nullable=True),
        # Valores
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("valor_desconto", sa.Numeric(12, 2), nullable=True),
        sa.Column("valor_juros_multa", sa.Numeric(12, 2), nullable=True),
        sa.Column("valor_pago", sa.Numeric(12, 2), nullable=True),
        # Datas
        sa.Column("data_competencia", sa.Date(), nullable=False),
        sa.Column("data_vencimento", sa.Date(), nullable=False),
        sa.Column("data_pagamento", sa.Date(), nullable=True),
        # Status e recorrência
        sa.Column(
            "status", sa.String(20),
            nullable=False, server_default="PENDENTE",
        ),
        sa.Column(
            "recorrencia", sa.String(15),
            nullable=False, server_default="UNICA",
        ),
        sa.Column("despesa_pai_id", sa.BigInteger(), nullable=True),
        # Pagamento
        sa.Column("forma_pagamento", sa.String(30), nullable=True),
        sa.Column("conta_saida", sa.String(50), nullable=True),
        # Fornecedor / Documento
        sa.Column("fornecedor_id", sa.BigInteger(), nullable=True),
        sa.Column("fornecedor_nome", sa.String(300), nullable=True),
        sa.Column("fornecedor_cnpj_cpf", sa.String(14), nullable=True),
        sa.Column("numero_documento", sa.String(100), nullable=True),
        sa.Column("tipo_documento", sa.String(30), nullable=True),
        # Empresa
        sa.Column("empresa_id", sa.BigInteger(), nullable=True),
        # Auditoria
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        # Constraints
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["despesa_pai_id"], ["despesas.id"], ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["fornecedor_id"], ["fornecedores.id"], ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"], ["empresas.id"], ondelete="SET NULL",
        ),
    )

    # Índices simples
    op.create_index("ix_despesas_categoria", "despesas", ["categoria"])
    op.create_index("ix_despesas_status", "despesas", ["status"])
    op.create_index("ix_despesas_centro_custo", "despesas", ["centro_custo"])
    op.create_index("ix_despesas_data_competencia", "despesas", ["data_competencia"])
    op.create_index("ix_despesas_data_vencimento", "despesas", ["data_vencimento"])
    op.create_index("ix_despesas_fornecedor_id", "despesas", ["fornecedor_id"])
    op.create_index("ix_despesas_empresa_id", "despesas", ["empresa_id"])

    # Índices compostos para analytics
    op.create_index(
        "ix_despesas_categoria_status",
        "despesas", ["categoria", "status"],
    )
    op.create_index(
        "ix_despesas_vencimento_status",
        "despesas", ["data_vencimento", "status"],
    )


def downgrade():
    op.drop_table("despesas")