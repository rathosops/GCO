"""add company occupational tables

Enriquece módulo de empresas para clínica ocupacional:
- Novos campos em empresas (razao_social, cnae, grau_risco, endereço, RH)
- empresa_setores: setores com riscos ocupacionais
- empresa_cargos: cargos com exames obrigatórios e NRs
- vinculos_empregado: vínculo completo paciente↔empresa

Revision ID: add_company_occupational
Revises: add_prescriptions
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

revision = "add_company_occupational"
down_revision = "recreate_audit_logs_legacy"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Novos campos em empresas ──────────────────────────────────
    with op.batch_alter_table("empresas") as batch:
        batch.add_column(sa.Column("razao_social", sa.String(300), nullable=True))
        batch.add_column(sa.Column("cnae", sa.String(10), nullable=True))
        batch.add_column(sa.Column("cnae_descricao", sa.String(300), nullable=True))
        batch.add_column(sa.Column("grau_risco", sa.SmallInteger(), nullable=True))
        batch.add_column(sa.Column("cep", sa.String(8), nullable=True))
        batch.add_column(sa.Column("logradouro", sa.String(300), nullable=True))
        batch.add_column(sa.Column("numero", sa.String(20), nullable=True))
        batch.add_column(sa.Column("complemento", sa.String(100), nullable=True))
        batch.add_column(sa.Column("bairro", sa.String(100), nullable=True))
        batch.add_column(sa.Column("cidade", sa.String(100), nullable=True))
        batch.add_column(sa.Column("uf", sa.String(2), nullable=True))
        batch.add_column(sa.Column("contato_rh_nome", sa.String(200), nullable=True))
        batch.add_column(sa.Column("contato_rh_telefone", sa.BigInteger(), nullable=True))
        batch.add_column(sa.Column("contato_rh_email", sa.String(200), nullable=True))
        batch.add_column(sa.Column("inscricao_estadual", sa.String(20), nullable=True))
        batch.add_column(sa.Column("inscricao_municipal", sa.String(20), nullable=True))
        batch.add_column(
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default="true")
        )
        batch.add_column(sa.Column("observacoes", sa.Text(), nullable=True))

    # Popula razao_social com nome existente (não pode ser NOT NULL direto)
    op.execute("UPDATE empresas SET razao_social = nome WHERE razao_social IS NULL")
    op.alter_column("empresas", "razao_social", nullable=False)

    op.create_index("ix_empresas_cnae", "empresas", ["cnae"])

    # ── 2. Setores de empresa ────────────────────────────────────────
    op.create_table(
        "empresa_setores",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("empresa_id", sa.BigInteger(), nullable=False),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("riscos_ocupacionais", sa.JSON(), nullable=True),
        sa.Column(
            "ativo", sa.Boolean(), nullable=False, server_default="true"
        ),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["empresa_id"], ["empresas.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("empresa_id", "nome", name="uq_setor_empresa_nome"),
    )
    op.create_index("ix_empresa_setores_empresa_id", "empresa_setores", ["empresa_id"])

    # ── 3. Cargos de empresa ─────────────────────────────────────────
    op.create_table(
        "empresa_cargos",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("empresa_id", sa.BigInteger(), nullable=False),
        sa.Column("setor_id", sa.BigInteger(), nullable=True),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("cbo", sa.String(10), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("riscos_ocupacionais", sa.JSON(), nullable=True),
        sa.Column("exames_obrigatorios", sa.JSON(), nullable=True),
        sa.Column("nrs_aplicaveis", sa.JSON(), nullable=True),
        sa.Column(
            "periodicidade_meses", sa.SmallInteger(),
            nullable=False, server_default="12",
        ),
        sa.Column(
            "manipula_alimentos", sa.Boolean(),
            nullable=False, server_default="false",
        ),
        sa.Column(
            "ativo", sa.Boolean(), nullable=False, server_default="true"
        ),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["empresa_id"], ["empresas.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["setor_id"], ["empresa_setores.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("empresa_id", "nome", name="uq_cargo_empresa_nome"),
    )
    op.create_index("ix_empresa_cargos_empresa_id", "empresa_cargos", ["empresa_id"])
    op.create_index("ix_empresa_cargos_setor_id", "empresa_cargos", ["setor_id"])

    # ── 4. Vínculos empregatícios ────────────────────────────────────
    op.create_table(
        "vinculos_empregado",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("paciente_id", sa.BigInteger(), nullable=False),
        sa.Column("empresa_id", sa.BigInteger(), nullable=False),
        sa.Column("cargo_id", sa.BigInteger(), nullable=True),
        sa.Column("setor_id", sa.BigInteger(), nullable=True),
        sa.Column("matricula", sa.String(50), nullable=True),
        sa.Column("funcao", sa.String(200), nullable=False),
        sa.Column("data_admissao", sa.Date(), nullable=False),
        sa.Column("data_desligamento", sa.Date(), nullable=True),
        sa.Column(
            "status", sa.String(20),
            nullable=False, server_default="ATIVO",
        ),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["paciente_id"], ["pacientes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"], ["empresas.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["cargo_id"], ["empresa_cargos.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["setor_id"], ["empresa_setores.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_vinculos_empregado_paciente_id",
        "vinculos_empregado", ["paciente_id"],
    )
    op.create_index(
        "ix_vinculos_empregado_empresa_id",
        "vinculos_empregado", ["empresa_id"],
    )
    op.create_index(
        "ix_vinculos_empregado_status",
        "vinculos_empregado", ["status"],
    )
    op.create_index(
        "ix_vinculo_paciente_empresa_ativo",
        "vinculos_empregado", ["paciente_id", "empresa_id", "status"],
    )


def downgrade():
    op.drop_table("vinculos_empregado")
    op.drop_table("empresa_cargos")
    op.drop_table("empresa_setores")

    op.drop_index("ix_empresas_cnae", table_name="empresas")

    with op.batch_alter_table("empresas") as batch:
        batch.drop_column("observacoes")
        batch.drop_column("ativo")
        batch.drop_column("inscricao_municipal")
        batch.drop_column("inscricao_estadual")
        batch.drop_column("contato_rh_email")
        batch.drop_column("contato_rh_telefone")
        batch.drop_column("contato_rh_nome")
        batch.drop_column("uf")
        batch.drop_column("cidade")
        batch.drop_column("bairro")
        batch.drop_column("complemento")
        batch.drop_column("numero")
        batch.drop_column("logradouro")
        batch.drop_column("cep")
        batch.drop_column("grau_risco")
        batch.drop_column("cnae_descricao")
        batch.drop_column("cnae")
        batch.drop_column("razao_social")