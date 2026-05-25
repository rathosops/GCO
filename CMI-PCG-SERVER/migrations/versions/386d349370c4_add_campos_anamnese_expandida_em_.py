"""add campos anamnese expandida em consultas

Revision ID: 386d349370c4
Revises: 46e67639198f
Create Date: 2026-01-05 14:07:07.795302
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "386d349370c4"
down_revision = "46e67639198f"
branch_labels = None
depends_on = None


# ============================================================
# Helpers (padrão ouro para migrações idempotentes)
# ============================================================

def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        return column in [c["name"] for c in inspector.get_columns(table)]
    except Exception:
        return False


def _index_exists(table: str, index_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        return index_name in [i["name"] for i in inspector.get_indexes(table)]
    except Exception:
        return False


def _constraint_exists(table: str, constraint_name: str) -> bool:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        return constraint_name in [c["name"] for c in inspector.get_unique_constraints(table)]
    except Exception:
        return False


# ============================================================
# UPGRADE
# ============================================================

def upgrade():
    # ========================================================
    # CONSULTAS
    # ========================================================
    with op.batch_alter_table("consultas", schema=None) as batch_op:
        if not _column_exists("consultas", "queixa_principal"):
            batch_op.add_column(sa.Column("queixa_principal", sa.String(500), nullable=True))

        if not _column_exists("consultas", "historia_doenca_atual"):
            batch_op.add_column(sa.Column("historia_doenca_atual", sa.Text(), nullable=True))

        if not _column_exists("consultas", "exame_fisico"):
            batch_op.add_column(sa.Column("exame_fisico", sa.Text(), nullable=True))

        if not _column_exists("consultas", "diagnostico"):
            batch_op.add_column(sa.Column("diagnostico", sa.String(500), nullable=True))

        if not _column_exists("consultas", "cid"):
            batch_op.add_column(sa.Column("cid", sa.String(10), nullable=True))

        if not _column_exists("consultas", "conduta"):
            batch_op.add_column(sa.Column("conduta", sa.Text(), nullable=True))

        if not _column_exists("consultas", "retorno_em"):
            batch_op.add_column(sa.Column("retorno_em", sa.Integer(), nullable=True))

        if not _column_exists("consultas", "data_retorno"):
            batch_op.add_column(sa.Column("data_retorno", sa.Date(), nullable=True))

        if not _column_exists("consultas", "observacoes_internas"):
            batch_op.add_column(sa.Column("observacoes_internas", sa.Text(), nullable=True))

        if not _column_exists("consultas", "created_at"):
            batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))

        if not _column_exists("consultas", "updated_at"):
            batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

        # Ajustes de tipo (VARCHAR -> TEXT), seguros
        if _column_exists("consultas", "anamnese"):
            batch_op.alter_column(
                "anamnese",
                existing_type=sa.VARCHAR(),
                type_=sa.Text(),
                existing_nullable=True,
            )

        if _column_exists("consultas", "medicamentos_prescrevidos"):
            batch_op.alter_column(
                "medicamentos_prescrevidos",
                existing_type=sa.VARCHAR(),
                type_=sa.Text(),
                existing_nullable=True,
            )

        # Índices
        if not _index_exists("consultas", "ix_consultas_cpf_paciente"):
            batch_op.create_index("ix_consultas_cpf_paciente", ["cpf_paciente"], unique=False)

        if not _index_exists("consultas", "ix_consultas_crm_medico"):
            batch_op.create_index("ix_consultas_crm_medico", ["crm_medico"], unique=False)

        if not _index_exists("consultas", "ix_consultas_data"):
            batch_op.create_index("ix_consultas_data", ["data"], unique=False)

        if not _index_exists("consultas", "ix_consultas_tipo"):
            batch_op.create_index("ix_consultas_tipo", ["tipo"], unique=False)

    # ========================================================
    # SOLICITACOES_DE_EXAMES
    # ========================================================
    with op.batch_alter_table("solicitacoes_de_exames", schema=None) as batch_op:
        if not _column_exists("solicitacoes_de_exames", "exames_ids"):
            batch_op.add_column(sa.Column("exames_ids", sa.String(500), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "valor_desconto"):
            batch_op.add_column(sa.Column("valor_desconto", sa.Float(), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "valor_final"):
            batch_op.add_column(sa.Column("valor_final", sa.Float(), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "observacoes"):
            batch_op.add_column(sa.Column("observacoes", sa.Text(), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "crm_medico"):
            batch_op.add_column(sa.Column("crm_medico", sa.BigInteger(), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "nome_medico"):
            batch_op.add_column(sa.Column("nome_medico", sa.String(200), nullable=True))

        if not _column_exists("solicitacoes_de_exames", "created_at"):
            batch_op.add_column(
                sa.Column(
                    "created_at",
                    sa.DateTime(),
                    server_default=sa.text("now()"),
                    nullable=False,
                )
            )

        if not _column_exists("solicitacoes_de_exames", "updated_at"):
            batch_op.add_column(
                sa.Column(
                    "updated_at",
                    sa.DateTime(),
                    server_default=sa.text("now()"),
                    nullable=False,
                )
            )

        if _column_exists("solicitacoes_de_exames", "exames"):
            batch_op.alter_column(
                "exames",
                existing_type=sa.VARCHAR(),
                type_=sa.Text(),
                existing_nullable=False,
            )

        if _constraint_exists(
            "solicitacoes_de_exames",
            "uq_solicitacoes_de_exames_cpf_paciente",
        ):
            batch_op.drop_constraint(
                "uq_solicitacoes_de_exames_cpf_paciente",
                type_="unique",
            )

        if not _index_exists("solicitacoes_de_exames", "ix_solicitacoes_de_exames_cpf_paciente"):
            batch_op.create_index(
                "ix_solicitacoes_de_exames_cpf_paciente",
                ["cpf_paciente"],
                unique=False,
            )

        if not _index_exists("solicitacoes_de_exames", "ix_solicitacoes_de_exames_data"):
            batch_op.create_index(
                "ix_solicitacoes_de_exames_data",
                ["data"],
                unique=False,
            )

    # Remove defaults temporários
    op.execute(
        "ALTER TABLE solicitacoes_de_exames ALTER COLUMN created_at DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE solicitacoes_de_exames ALTER COLUMN updated_at DROP DEFAULT"
    )


# ============================================================
# DOWNGRADE
# ============================================================

def downgrade():
    # SOLICITACOES_DE_EXAMES
    with op.batch_alter_table("solicitacoes_de_exames", schema=None) as batch_op:
        if _index_exists("solicitacoes_de_exames", "ix_solicitacoes_de_exames_data"):
            batch_op.drop_index("ix_solicitacoes_de_exames_data")

        if _index_exists("solicitacoes_de_exames", "ix_solicitacoes_de_exames_cpf_paciente"):
            batch_op.drop_index("ix_solicitacoes_de_exames_cpf_paciente")

        if not _constraint_exists(
            "solicitacoes_de_exames",
            "uq_solicitacoes_de_exames_cpf_paciente",
        ):
            batch_op.create_unique_constraint(
                "uq_solicitacoes_de_exames_cpf_paciente",
                ["cpf_paciente"],
            )

        if _column_exists("solicitacoes_de_exames", "exames"):
            batch_op.alter_column(
                "exames",
                existing_type=sa.Text(),
                type_=sa.VARCHAR(),
                existing_nullable=False,
            )

        for col in [
            "updated_at",
            "created_at",
            "nome_medico",
            "crm_medico",
            "observacoes",
            "valor_final",
            "valor_desconto",
            "exames_ids",
        ]:
            if _column_exists("solicitacoes_de_exames", col):
                batch_op.drop_column(col)

    # CONSULTAS
    with op.batch_alter_table("consultas", schema=None) as batch_op:
        for idx in [
            "ix_consultas_tipo",
            "ix_consultas_data",
            "ix_consultas_crm_medico",
            "ix_consultas_cpf_paciente",
        ]:
            if _index_exists("consultas", idx):
                batch_op.drop_index(idx)

        if _column_exists("consultas", "medicamentos_prescrevidos"):
            batch_op.alter_column(
                "medicamentos_prescrevidos",
                existing_type=sa.Text(),
                type_=sa.VARCHAR(),
                existing_nullable=True,
            )

        if _column_exists("consultas", "anamnese"):
            batch_op.alter_column(
                "anamnese",
                existing_type=sa.Text(),
                type_=sa.VARCHAR(),
                existing_nullable=True,
            )

        for col in [
            "updated_at",
            "created_at",
            "observacoes_internas",
            "data_retorno",
            "retorno_em",
            "conduta",
            "cid",
            "diagnostico",
            "exame_fisico",
            "historia_doenca_atual",
            "queixa_principal",
        ]:
            if _column_exists("consultas", col):
                batch_op.drop_column(col)
