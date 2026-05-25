"""Fix cpf_paciente to String(11) and monetary columns to Numeric(10,2)

Corrige:
1. solicitacoes_de_exames.cpf_paciente: BigInteger → String(11)
   - Preserva zeros à esquerda (ex: CPF 01234567890)
   - Consistência com pacientes.cpf que já é String(11)
2. exames: Float → Numeric(10,2) nos campos monetários
3. solicitacoes_de_exames: Float → Numeric(10,2) nos campos monetários

Revision ID: fix_cpf_and_numeric_types
Revises: add_nr7_fields_asos
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "fix_cpf_and_numeric_types"
down_revision = "add_nr7_fields_asos"
branch_labels = None
depends_on = None


def _get_fk_constraint_name(conn, table: str, column: str) -> str | None:
    """Descobre o nome real da FK constraint via information_schema."""
    result = conn.execute(text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = :table
            AND kcu.column_name = :column
        LIMIT 1
    """), {"table": table, "column": column})
    row = result.fetchone()
    return row[0] if row else None


def upgrade():
    conn = op.get_bind()

    # ── 1. Corrigir cpf_paciente em solicitacoes_de_exames ───────────────
    #
    # Converte BigInteger → String(11) com zfill para preservar zeros.
    # A FK para pacientes.cpf (que já é String) precisa do mesmo tipo.

    # Descobrir e dropar FK real (se existir)
    fk_name = _get_fk_constraint_name(conn, "solicitacoes_de_exames", "cpf_paciente")
    if fk_name:
        conn.execute(text(
            f'ALTER TABLE solicitacoes_de_exames DROP CONSTRAINT "{fk_name}"'
        ))

    # Converter dados: BigInteger → String(11) com lpad de zeros
    conn.execute(text("""
        ALTER TABLE solicitacoes_de_exames
        ALTER COLUMN cpf_paciente TYPE VARCHAR(11)
        USING lpad(cpf_paciente::text, 11, '0')
    """))

    # Recriar FK
    conn.execute(text("""
        ALTER TABLE solicitacoes_de_exames
        ADD CONSTRAINT solicitacoes_de_exames_cpf_paciente_fkey
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf)
    """))

    # ── 2. Corrigir campos monetários em exames ─────────────────────────
    for col_name in ("valor_cmi", "valor_venda", "valor_parceiro"):
        conn.execute(text(f"""
            ALTER TABLE exames
            ALTER COLUMN {col_name} TYPE NUMERIC(10, 2)
            USING COALESCE({col_name}, 0)::NUMERIC(10, 2)
        """))

    # ── 3. Corrigir campos monetários em solicitacoes_de_exames ──────────
    for col_name in ("soma_dos_valores", "valor_desconto", "valor_final"):
        conn.execute(text(f"""
            ALTER TABLE solicitacoes_de_exames
            ALTER COLUMN {col_name} TYPE NUMERIC(10, 2)
            USING COALESCE({col_name}, 0)::NUMERIC(10, 2)
        """))


def downgrade():
    conn = op.get_bind()

    # Reverter monetários em solicitacoes_de_exames
    for col_name in ("soma_dos_valores", "valor_desconto", "valor_final"):
        conn.execute(text(f"""
            ALTER TABLE solicitacoes_de_exames
            ALTER COLUMN {col_name} TYPE DOUBLE PRECISION
            USING {col_name}::DOUBLE PRECISION
        """))

    # Reverter monetários em exames
    for col_name in ("valor_cmi", "valor_venda", "valor_parceiro"):
        conn.execute(text(f"""
            ALTER TABLE exames
            ALTER COLUMN {col_name} TYPE DOUBLE PRECISION
            USING {col_name}::DOUBLE PRECISION
        """))

    # Reverter cpf_paciente para BigInteger
    fk_name = _get_fk_constraint_name(conn, "solicitacoes_de_exames", "cpf_paciente")
    if fk_name:
        conn.execute(text(
            f'ALTER TABLE solicitacoes_de_exames DROP CONSTRAINT "{fk_name}"'
        ))

    conn.execute(text("""
        ALTER TABLE solicitacoes_de_exames
        ALTER COLUMN cpf_paciente TYPE BIGINT
        USING cpf_paciente::BIGINT
    """))

    conn.execute(text("""
        ALTER TABLE solicitacoes_de_exames
        ADD CONSTRAINT solicitacoes_de_exames_cpf_paciente_fkey
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf)
    """))