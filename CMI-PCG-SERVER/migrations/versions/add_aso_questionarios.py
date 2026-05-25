"""add aso_questionarios table

Cria tabela para questionários de anamnese ocupacional vinculados
a solicitações de ASO. Suporta cenário de form recebido antes
da criação do ASO (aso_id nullable + cpf_paciente como lookup).

Revision ID: add_aso_questionarios
Revises: add_company_occupational
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa

revision = "add_aso_questionarios"
down_revision = "add_company_occupational"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "aso_questionarios",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("aso_id", sa.BigInteger(), nullable=True),
        # VARCHAR(11) — tipo idêntico a pacientes.cpf
        sa.Column("cpf_paciente", sa.String(11), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pendente",
        ),
        sa.Column("anamnese", sa.JSON(), nullable=False),
        sa.Column("exame_clinico", sa.JSON(), nullable=True),
        sa.Column("observacoes_medicas", sa.Text(), nullable=True),
        sa.Column(
            "origem",
            sa.String(30),
            nullable=False,
            server_default="manual",
        ),
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
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["aso_id"],
            ["solicitacoes_de_asos.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["cpf_paciente"],
            ["pacientes.cpf"],
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_aso_questionarios_aso_id",
        "aso_questionarios",
        ["aso_id"],
        unique=True,
    )
    op.create_index(
        "ix_aso_questionarios_cpf_paciente",
        "aso_questionarios",
        ["cpf_paciente"],
    )
    op.create_index(
        "ix_aso_questionarios_status",
        "aso_questionarios",
        ["status"],
    )
    op.create_index(
        "ix_aso_questionarios_cpf_pendente",
        "aso_questionarios",
        ["cpf_paciente"],
        postgresql_where=sa.text("aso_id IS NULL"),
    )


def downgrade():
    op.drop_index("ix_aso_questionarios_cpf_pendente", table_name="aso_questionarios")
    op.drop_index("ix_aso_questionarios_status", table_name="aso_questionarios")
    op.drop_index("ix_aso_questionarios_cpf_paciente", table_name="aso_questionarios")
    op.drop_index("ix_aso_questionarios_aso_id", table_name="aso_questionarios")
    op.drop_table("aso_questionarios")
