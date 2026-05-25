"""add prescriptions tables (receituários médicos)

Tabelas criadas:
- receituarios: Prescrições médicas (cabeçalho)
- receituario_itens: Itens individuais de cada receita

Tipos de receita:
- SIMPLES: Receita branca comum
- CONTROLE_ESPECIAL: Medicamentos C1/C5 (tarja vermelha)
- ANTIMICROBIANO: Antibióticos (retenção obrigatória)

Revision ID: add_prescriptions
Revises: add_stock_management
Create Date: 2026-02-20
"""

from alembic import op
import sqlalchemy as sa

revision = "add_prescriptions"
down_revision = "add_stock_management"
branch_labels = None
depends_on = None


def upgrade():
    """Cria tabelas do módulo de receituários médicos."""

    # ── Receituários (cabeçalho) ─────────────────────────────────────
    op.create_table(
        "receituarios",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        # Vínculos clínicos
        sa.Column("consulta_id", sa.BigInteger(), nullable=True),
        sa.Column("cpf_paciente", sa.String(11), nullable=False),
        sa.Column("crm_medico", sa.BigInteger(), nullable=False),
        # Classificação
        sa.Column(
            "tipo_receita",
            sa.String(25),
            nullable=False,
            server_default="SIMPLES",
        ),
        # Datas
        sa.Column("data_prescricao", sa.Date(), nullable=False),
        sa.Column(
            "validade_dias",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column("data_validade", sa.Date(), nullable=False),
        # Conteúdo
        sa.Column("observacoes_gerais", sa.Text(), nullable=True),
        sa.Column("orientacoes_paciente", sa.Text(), nullable=True),
        # Status
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="ATIVA",
        ),
        sa.Column("motivo_cancelamento", sa.Text(), nullable=True),
        # Número de vias (controle especial = 2, antimicrobiano = 2)
        sa.Column(
            "numero_vias",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
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
            ["consulta_id"], ["consultas.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["cpf_paciente"], ["pacientes.cpf"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["crm_medico"], ["medicos.crm"], ondelete="RESTRICT"
        ),
    )
    op.create_index(
        "ix_receituarios_cpf_paciente", "receituarios", ["cpf_paciente"]
    )
    op.create_index("ix_receituarios_crm_medico", "receituarios", ["crm_medico"])
    op.create_index(
        "ix_receituarios_data_prescricao", "receituarios", ["data_prescricao"]
    )
    op.create_index("ix_receituarios_status", "receituarios", ["status"])
    op.create_index(
        "ix_receituarios_tipo_receita", "receituarios", ["tipo_receita"]
    )
    op.create_index(
        "ix_receituarios_consulta_id", "receituarios", ["consulta_id"]
    )

    # ── Itens do receituário ─────────────────────────────────────────
    op.create_table(
        "receituario_itens",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("receituario_id", sa.BigInteger(), nullable=False),
        # Medicamento (opcional – pode ser medicamento externo)
        sa.Column("medicamento_id", sa.BigInteger(), nullable=True),
        # Dados da prescrição (sempre preenchidos, mesmo com medicamento_id)
        sa.Column("nome_medicamento", sa.String(300), nullable=False),
        sa.Column("principio_ativo", sa.String(300), nullable=True),
        sa.Column("concentracao", sa.String(100), nullable=True),
        sa.Column("forma_farmaceutica", sa.String(50), nullable=True),
        # Posologia
        sa.Column("via_administracao", sa.String(30), nullable=True),
        sa.Column("posologia", sa.Text(), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=True),
        sa.Column("unidade_quantidade", sa.String(20), nullable=True),
        sa.Column("duracao_dias", sa.Integer(), nullable=True),
        sa.Column("uso_continuo", sa.Boolean(), nullable=False, server_default="false"),
        # Amostra grátis / dispensação
        sa.Column(
            "is_amostra_gratis",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "dispensado",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("dispensado_lote_id", sa.BigInteger(), nullable=True),
        sa.Column("dispensado_quantidade", sa.Integer(), nullable=True),
        sa.Column("dispensado_em", sa.DateTime(timezone=True), nullable=True),
        # Ordem no receituário
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="1"),
        # Observações do item
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
            ["receituario_id"], ["receituarios.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["medicamento_id"], ["medicamentos.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["dispensado_lote_id"], ["medicamento_lotes.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_receituario_itens_receituario_id",
        "receituario_itens",
        ["receituario_id"],
    )
    op.create_index(
        "ix_receituario_itens_medicamento_id",
        "receituario_itens",
        ["medicamento_id"],
    )


def downgrade():
    """Remove tabelas do módulo de receituários."""
    op.drop_index(
        "ix_receituario_itens_medicamento_id", table_name="receituario_itens"
    )
    op.drop_index(
        "ix_receituario_itens_receituario_id", table_name="receituario_itens"
    )
    op.drop_table("receituario_itens")

    op.drop_index("ix_receituarios_consulta_id", table_name="receituarios")
    op.drop_index("ix_receituarios_tipo_receita", table_name="receituarios")
    op.drop_index("ix_receituarios_status", table_name="receituarios")
    op.drop_index("ix_receituarios_data_prescricao", table_name="receituarios")
    op.drop_index("ix_receituarios_crm_medico", table_name="receituarios")
    op.drop_index("ix_receituarios_cpf_paciente", table_name="receituarios")
    op.drop_table("receituarios")