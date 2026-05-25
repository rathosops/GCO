"""add stock management tables

Tabelas criadas:
- fornecedores: Cadastro de fornecedores de medicamentos
- medicamentos: Catálogo de medicamentos com classificação ANVISA
- medicamento_lotes: Lotes com validade, código de barras e quantidades
- movimentacoes_estoque: Log imutável de movimentações

Revision ID: add_stock_management
Revises: add_nota_fiscal_pagamentos
Create Date: 2026-02-19
"""

from alembic import op
import sqlalchemy as sa

revision = "add_stock_management"
down_revision = "fix_cpf_and_numeric_types"
branch_labels = None
depends_on = None


def upgrade():
    """Cria tabelas do módulo de controle de estoque."""

    # ── Fornecedores ─────────────────────────────────────────────────
    op.create_table(
        "fornecedores",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("cnpj", sa.String(14), nullable=False),
        sa.Column("razao_social", sa.String(300), nullable=True),
        sa.Column("telefone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("contato_responsavel", sa.String(200), nullable=True),
        sa.Column("cep", sa.String(8), nullable=True),
        sa.Column("logradouro", sa.String(300), nullable=True),
        sa.Column("numero", sa.String(20), nullable=True),
        sa.Column("complemento", sa.String(200), nullable=True),
        sa.Column("bairro", sa.String(100), nullable=True),
        sa.Column("cidade", sa.String(100), nullable=True),
        sa.Column("uf", sa.String(2), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("observacoes", sa.Text(), nullable=True),
        # Auditoria
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fornecedores_cnpj", "fornecedores", ["cnpj"], unique=True)
    op.create_index("ix_fornecedores_nome", "fornecedores", ["nome"])

    # ── Medicamentos (catálogo) ──────────────────────────────────────
    op.create_table(
        "medicamentos",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("nome_comercial", sa.String(300), nullable=False),
        sa.Column("principio_ativo", sa.String(300), nullable=False),
        sa.Column("apresentacao", sa.String(300), nullable=True),
        sa.Column("forma_farmaceutica", sa.String(30), nullable=True),
        sa.Column("unidade_medida", sa.String(10), nullable=False, server_default="UN"),
        sa.Column("concentracao", sa.String(50), nullable=True),
        sa.Column(
            "classificacao_anvisa",
            sa.String(20),
            nullable=False,
            server_default="LIVRE",
        ),
        sa.Column("registro_anvisa", sa.String(20), nullable=True),
        sa.Column(
            "requer_receita_especial",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("fabricante", sa.String(200), nullable=True),
        sa.Column("estoque_minimo", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("estoque_maximo", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("observacoes", sa.Text(), nullable=True),
        # Auditoria
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_medicamentos_nome_comercial", "medicamentos", ["nome_comercial"]
    )
    op.create_index(
        "ix_medicamentos_principio_ativo", "medicamentos", ["principio_ativo"]
    )
    op.create_index(
        "ix_medicamentos_classificacao", "medicamentos", ["classificacao_anvisa"]
    )

    # ── Lotes de medicamentos ────────────────────────────────────────
    op.create_table(
        "medicamento_lotes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("medicamento_id", sa.BigInteger(), nullable=False),
        sa.Column("numero_lote", sa.String(50), nullable=False),
        sa.Column("codigo_barras", sa.String(14), nullable=True),
        sa.Column("data_validade", sa.Date(), nullable=False),
        sa.Column("data_fabricacao", sa.Date(), nullable=True),
        sa.Column("quantidade_inicial", sa.Integer(), nullable=False),
        sa.Column("quantidade_atual", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("preco_unitario", sa.Float(), nullable=True),
        sa.Column("fornecedor_id", sa.BigInteger(), nullable=True),
        sa.Column("nota_fiscal_entrada", sa.String(50), nullable=True),
        sa.Column("localizacao", sa.String(100), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true"),
        # Auditoria
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["medicamento_id"], ["medicamentos.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["fornecedor_id"], ["fornecedores.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_medicamento_lotes_medicamento_id", "medicamento_lotes", ["medicamento_id"]
    )
    op.create_index(
        "ix_medicamento_lotes_numero_lote", "medicamento_lotes", ["numero_lote"]
    )
    op.create_index(
        "ix_medicamento_lotes_codigo_barras", "medicamento_lotes", ["codigo_barras"]
    )
    op.create_index(
        "ix_medicamento_lotes_data_validade", "medicamento_lotes", ["data_validade"]
    )
    op.create_index(
        "ix_medicamento_lotes_fornecedor_id", "medicamento_lotes", ["fornecedor_id"]
    )

    # ── Movimentações de estoque ─────────────────────────────────────
    op.create_table(
        "movimentacoes_estoque",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("lote_id", sa.BigInteger(), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False),
        sa.Column("saldo_anterior", sa.Integer(), nullable=False),
        sa.Column("saldo_posterior", sa.Integer(), nullable=False),
        sa.Column("data_movimentacao", sa.Date(), nullable=False),
        # Dispensação
        sa.Column("cpf_paciente", sa.String(11), nullable=True),
        sa.Column("consulta_id", sa.BigInteger(), nullable=True),
        sa.Column("crm_medico_prescritor", sa.BigInteger(), nullable=True),
        # Entrada
        sa.Column("fornecedor_id", sa.BigInteger(), nullable=True),
        sa.Column("nota_fiscal", sa.String(50), nullable=True),
        # Descarte
        sa.Column("motivo_descarte", sa.String(20), nullable=True),
        # Geral
        sa.Column("observacoes", sa.Text(), nullable=True),
        # Auditoria
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_id", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["lote_id"], ["medicamento_lotes.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["cpf_paciente"], ["pacientes.cpf"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["consulta_id"], ["consultas.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["fornecedor_id"], ["fornecedores.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_movimentacoes_estoque_lote_id", "movimentacoes_estoque", ["lote_id"]
    )
    op.create_index("ix_movimentacoes_estoque_tipo", "movimentacoes_estoque", ["tipo"])
    op.create_index(
        "ix_movimentacoes_estoque_data", "movimentacoes_estoque", ["data_movimentacao"]
    )
    op.create_index(
        "ix_movimentacoes_estoque_cpf", "movimentacoes_estoque", ["cpf_paciente"]
    )


def downgrade():
    """Remove tabelas do módulo de estoque (ordem reversa)."""
    op.drop_index("ix_movimentacoes_estoque_cpf", table_name="movimentacoes_estoque")
    op.drop_index("ix_movimentacoes_estoque_data", table_name="movimentacoes_estoque")
    op.drop_index("ix_movimentacoes_estoque_tipo", table_name="movimentacoes_estoque")
    op.drop_index(
        "ix_movimentacoes_estoque_lote_id", table_name="movimentacoes_estoque"
    )
    op.drop_table("movimentacoes_estoque")

    op.drop_index("ix_medicamento_lotes_fornecedor_id", table_name="medicamento_lotes")
    op.drop_index("ix_medicamento_lotes_data_validade", table_name="medicamento_lotes")
    op.drop_index("ix_medicamento_lotes_codigo_barras", table_name="medicamento_lotes")
    op.drop_index("ix_medicamento_lotes_numero_lote", table_name="medicamento_lotes")
    op.drop_index("ix_medicamento_lotes_medicamento_id", table_name="medicamento_lotes")
    op.drop_table("medicamento_lotes")

    op.drop_index("ix_medicamentos_classificacao", table_name="medicamentos")
    op.drop_index("ix_medicamentos_principio_ativo", table_name="medicamentos")
    op.drop_index("ix_medicamentos_nome_comercial", table_name="medicamentos")
    op.drop_table("medicamentos")

    op.drop_index("ix_fornecedores_nome", table_name="fornecedores")
    op.drop_index("ix_fornecedores_cnpj", table_name="fornecedores")
    op.drop_table("fornecedores")
