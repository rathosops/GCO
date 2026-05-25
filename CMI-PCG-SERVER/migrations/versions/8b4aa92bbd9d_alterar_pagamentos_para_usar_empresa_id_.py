"""Alterar pagamentos para usar empresa_id e convenio_id (IDEMPOTENTE)

Esta migração foi corrigida para ser IDEMPOTENTE:
- Verifica se colunas já existem antes de criar
- Verifica se constraints existem antes de remover
- Pode ser executada múltiplas vezes sem erro

Revision ID: 8b4aa92bbd9d
Revises:
Create Date: 2025-09-09 11:48:04.089134
"""

from alembic import op
import sqlalchemy as sa


revision = "8b4aa92bbd9d"
down_revision = None
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Verifica se uma coluna existe na tabela."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col["name"] for col in inspector.get_columns(table)]
    return column in columns


def _constraint_exists(table: str, constraint_name: str) -> bool:
    """Verifica se uma constraint existe (simplificado)."""
    conn = op.get_bind()
    try:
        # Tenta buscar a constraint no pg_constraint
        result = conn.execute(
            sa.text(
                f"""
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = '{table}' 
            AND constraint_name = '{constraint_name}'
        """
            )
        )
        return result.fetchone() is not None
    except Exception:
        return False


def upgrade():
    """Adiciona empresa_id e convenio_id se não existirem."""

    # Adiciona empresa_id se não existir
    if not _column_exists("pagamentos", "empresa_id"):
        op.add_column(
            "pagamentos", sa.Column("empresa_id", sa.BigInteger(), nullable=True)
        )

    # Adiciona convenio_id se não existir
    if not _column_exists("pagamentos", "convenio_id"):
        op.add_column(
            "pagamentos", sa.Column("convenio_id", sa.BigInteger(), nullable=True)
        )

    # Remove constraints antigas se existirem
    # (usa try/except porque verificar constraints é complexo)
    try:
        if _constraint_exists("pagamentos", "pagamentos_cnpj_empresas"):
            with op.batch_alter_table("pagamentos", schema=None) as batch_op:
                batch_op.drop_constraint("pagamentos_cnpj_empresas", type_="unique")
    except Exception:
        pass  # Constraint já não existe

    try:
        if _constraint_exists("pagamentos", "pagamentos_empresas_fk"):
            with op.batch_alter_table("pagamentos", schema=None) as batch_op:
                batch_op.drop_constraint("pagamentos_empresas_fk", type_="foreignkey")
    except Exception:
        pass

    try:
        if _constraint_exists("pagamentos", "pagamentos_convenios_fk"):
            with op.batch_alter_table("pagamentos", schema=None) as batch_op:
                batch_op.drop_constraint("pagamentos_convenios_fk", type_="foreignkey")
    except Exception:
        pass

    # Cria novas foreign keys (verifica se já existem)
    conn = op.get_bind()

    # FK para empresas
    try:
        result = conn.execute(
            sa.text(
                """
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'pagamentos' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%empresa%'
        """
            )
        )
        if not result.fetchone():
            with op.batch_alter_table("pagamentos", schema=None) as batch_op:
                batch_op.create_foreign_key(
                    "fk_pagamentos_empresa_id", "empresas", ["empresa_id"], ["id"]
                )
    except Exception:
        pass

    # FK para convenios
    try:
        result = conn.execute(
            sa.text(
                """
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'pagamentos' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%convenio%'
        """
            )
        )
        if not result.fetchone():
            with op.batch_alter_table("pagamentos", schema=None) as batch_op:
                batch_op.create_foreign_key(
                    "fk_pagamentos_convenio_id", "convenios", ["convenio_id"], ["id"]
                )
    except Exception:
        pass

    # Remove colunas antigas se existirem
    if _column_exists("pagamentos", "cnpj_convenios"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.drop_column("cnpj_convenios")

    if _column_exists("pagamentos", "cnpj_empresas"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.drop_column("cnpj_empresas")


def downgrade():
    """Reverte as alterações."""
    # Adiciona colunas antigas
    if not _column_exists("pagamentos", "cnpj_empresas"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("cnpj_empresas", sa.BigInteger(), nullable=True)
            )

    if not _column_exists("pagamentos", "cnpj_convenios"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("cnpj_convenios", sa.BigInteger(), nullable=True)
            )

    # Remove novas colunas
    if _column_exists("pagamentos", "convenio_id"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.drop_column("convenio_id")

    if _column_exists("pagamentos", "empresa_id"):
        with op.batch_alter_table("pagamentos", schema=None) as batch_op:
            batch_op.drop_column("empresa_id")
