"""atualiza models (IDEMPOTENTE)

Esta migração foi corrigida para ser IDEMPOTENTE:
- Verifica se colunas/constraints já existem antes de criar
- Pode ser executada múltiplas vezes sem erro

Revision ID: 5560c28f370c
Revises: 8b4aa92bbd9d
Create Date: 2025-12-23 13:07:46.638689
"""

from alembic import op
import sqlalchemy as sa


revision = "5560c28f370c"
down_revision = "8b4aa92bbd9d"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Verifica se uma coluna existe na tabela."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        columns = [col['name'] for col in inspector.get_columns(table)]
        return column in columns
    except Exception:
        return False


def _constraint_exists(table: str, constraint_name: str) -> bool:
    """Verifica se uma constraint existe."""
    conn = op.get_bind()
    try:
        result = conn.execute(sa.text(f"""
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = '{table}' 
            AND constraint_name = '{constraint_name}'
        """))
        return result.fetchone() is not None
    except Exception:
        return False


def upgrade():
    # =========================
    # agendamentos
    # =========================
    if not _column_exists('agendamentos', 'status'):
        with op.batch_alter_table("agendamentos", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("status", sa.String(), nullable=False, server_default="AGENDADO")
            )
    
    if not _column_exists('agendamentos', 'observacoes'):
        with op.batch_alter_table("agendamentos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("observacoes", sa.Text(), nullable=True))

    # =========================
    # autenticadores.tipo -> NOT NULL
    # =========================
    if _column_exists('autenticadores', 'tipo'):
        # Garante que não exista NULL antes de impor NOT NULL
        op.execute("UPDATE autenticadores SET tipo = 'desconhecido' WHERE tipo IS NULL")
        
        with op.batch_alter_table("autenticadores", schema=None) as batch_op:
            batch_op.alter_column("tipo", existing_type=sa.VARCHAR(), nullable=False)

    # =========================
    # clinica_infos: novas colunas
    # =========================
    if not _column_exists('clinica_infos', 'nome'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("nome", sa.String(), nullable=True))
    
    if not _column_exists('clinica_infos', 'cnpj_clinica'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("cnpj_clinica", sa.BigInteger(), nullable=True))
        
        # Preenche cnpj_clinica NULL com placeholder único por linha
        op.execute("""
            UPDATE clinica_infos
            SET cnpj_clinica = 10000000000000 + id
            WHERE cnpj_clinica IS NULL
        """)
        
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.alter_column(
                "cnpj_clinica",
                existing_type=sa.BigInteger(),
                nullable=False,
            )
        
        if not _constraint_exists('clinica_infos', 'uq_clinica_infos_cnpj_clinica'):
            with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
                batch_op.create_unique_constraint(
                    "uq_clinica_infos_cnpj_clinica", ["cnpj_clinica"]
                )
    
    if not _column_exists('clinica_infos', 'telefone_fixo'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("telefone_fixo", sa.BigInteger(), nullable=True))
    
    if not _column_exists('clinica_infos', 'telefone_celular'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("telefone_celular", sa.BigInteger(), nullable=True))
    
    if not _column_exists('clinica_infos', 'endereco'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("endereco", sa.String(), nullable=True))
    
    if not _column_exists('clinica_infos', 'website'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.add_column(sa.Column("website", sa.String(), nullable=True))

    # =========================
    # pacientes: novas colunas + FK
    # =========================
    new_pacientes_cols = ['sexo', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']
    
    if not _column_exists('pacientes', 'sexo'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("sexo", sa.String(length=1), nullable=True))
    
    if not _column_exists('pacientes', 'cep'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("cep", sa.String(length=8), nullable=True))
    
    if not _column_exists('pacientes', 'logradouro'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("logradouro", sa.String(), nullable=True))
    
    if not _column_exists('pacientes', 'numero'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("numero", sa.String(length=20), nullable=True))
    
    if not _column_exists('pacientes', 'complemento'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("complemento", sa.String(), nullable=True))
    
    if not _column_exists('pacientes', 'bairro'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("bairro", sa.String(), nullable=True))
    
    if not _column_exists('pacientes', 'cidade'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("cidade", sa.String(), nullable=True))
    
    if not _column_exists('pacientes', 'uf'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.add_column(sa.Column("uf", sa.String(length=2), nullable=True))

    # FK cnpj_convenio -> convenios
    if not _constraint_exists('pacientes', 'fk_pacientes_cnpj_convenio_convenios'):
        # Remove referências inválidas primeiro
        op.execute("""
            UPDATE pacientes p
            SET cnpj_convenio = NULL
            WHERE p.cnpj_convenio IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM convenios c WHERE c.cnpj = p.cnpj_convenio
              )
        """)
        
        try:
            with op.batch_alter_table("pacientes", schema=None) as batch_op:
                batch_op.create_foreign_key(
                    "fk_pacientes_cnpj_convenio_convenios",
                    "convenios",
                    ["cnpj_convenio"],
                    ["cnpj"],
                )
        except Exception:
            pass  # FK pode já existir com outro nome

    # =========================
    # solicitacoes_de_exames: UNIQUE cpf_paciente
    # =========================
    if not _constraint_exists('solicitacoes_de_exames', 'uq_solicitacoes_de_exames_cpf_paciente'):
        # Remove duplicados mantendo o mais recente
        op.execute("""
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY cpf_paciente
                        ORDER BY id DESC
                    ) AS rn
                FROM solicitacoes_de_exames
            )
            DELETE FROM solicitacoes_de_exames s
            USING ranked r
            WHERE s.id = r.id
              AND r.rn > 1
        """)
        
        with op.batch_alter_table("solicitacoes_de_exames", schema=None) as batch_op:
            batch_op.create_unique_constraint(
                "uq_solicitacoes_de_exames_cpf_paciente", ["cpf_paciente"]
            )


def downgrade():
    # Reverte somente o que esta migration criou/alterou
    
    if _constraint_exists('solicitacoes_de_exames', 'uq_solicitacoes_de_exames_cpf_paciente'):
        with op.batch_alter_table("solicitacoes_de_exames", schema=None) as batch_op:
            batch_op.drop_constraint(
                "uq_solicitacoes_de_exames_cpf_paciente", type_="unique"
            )

    if _constraint_exists('pacientes', 'fk_pacientes_cnpj_convenio_convenios'):
        with op.batch_alter_table("pacientes", schema=None) as batch_op:
            batch_op.drop_constraint(
                "fk_pacientes_cnpj_convenio_convenios", type_="foreignkey"
            )
    
    cols_to_drop = ['uf', 'cidade', 'bairro', 'complemento', 'numero', 'logradouro', 'cep', 'sexo']
    for col in cols_to_drop:
        if _column_exists('pacientes', col):
            with op.batch_alter_table("pacientes", schema=None) as batch_op:
                batch_op.drop_column(col)

    if _constraint_exists('clinica_infos', 'uq_clinica_infos_cnpj_clinica'):
        with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
            batch_op.drop_constraint("uq_clinica_infos_cnpj_clinica", type_="unique")
    
    clinica_cols = ['website', 'endereco', 'telefone_celular', 'telefone_fixo', 'cnpj_clinica', 'nome']
    for col in clinica_cols:
        if _column_exists('clinica_infos', col):
            with op.batch_alter_table("clinica_infos", schema=None) as batch_op:
                batch_op.drop_column(col)

    if _column_exists('autenticadores', 'tipo'):
        with op.batch_alter_table("autenticadores", schema=None) as batch_op:
            batch_op.alter_column("tipo", existing_type=sa.VARCHAR(), nullable=True)

    if _column_exists('agendamentos', 'observacoes'):
        with op.batch_alter_table("agendamentos", schema=None) as batch_op:
            batch_op.drop_column("observacoes")
    
    if _column_exists('agendamentos', 'status'):
        with op.batch_alter_table("agendamentos", schema=None) as batch_op:
            batch_op.drop_column("status")
