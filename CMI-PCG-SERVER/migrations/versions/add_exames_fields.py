"""Adiciona campos codigo, codigo_parceiro, valor_venda, ativo e timestamps em exames (IDEMPOTENTE)

Esta migração foi corrigida para ser IDEMPOTENTE:
- Verifica se colunas/índices já existem antes de criar
- Pode ser executada múltiplas vezes sem erro

Revision ID: add_exames_fields
Revises: None
Create Date: 2026-01-03
"""

from alembic import op
import sqlalchemy as sa


revision = "add_exames_fields"
down_revision = None
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


def _index_exists(table: str, index_name: str) -> bool:
    """Verifica se um índice existe."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        indexes = [idx['name'] for idx in inspector.get_indexes(table)]
        return index_name in indexes
    except Exception:
        return False


def upgrade():
    """Adiciona novos campos à tabela exames."""
    
    # Adiciona coluna codigo (único)
    if not _column_exists('exames', 'codigo'):
        op.add_column('exames', sa.Column('codigo', sa.String(20), nullable=True))
    
    if not _index_exists('exames', 'ix_exames_codigo'):
        op.create_index('ix_exames_codigo', 'exames', ['codigo'], unique=True)
    
    # Adiciona coluna codigo_parceiro
    if not _column_exists('exames', 'codigo_parceiro'):
        op.add_column('exames', sa.Column('codigo_parceiro', sa.String(50), nullable=True))
    
    if not _index_exists('exames', 'ix_exames_codigo_parceiro'):
        op.create_index('ix_exames_codigo_parceiro', 'exames', ['codigo_parceiro'])
    
    # Adiciona coluna valor_venda
    if not _column_exists('exames', 'valor_venda'):
        op.add_column(
            'exames',
            sa.Column('valor_venda', sa.Float, nullable=True, server_default='0')
        )
    
    # Adiciona coluna ativo
    if not _column_exists('exames', 'ativo'):
        op.add_column(
            'exames',
            sa.Column('ativo', sa.Boolean, nullable=False, server_default='true')
        )
    
    # Adiciona timestamps
    if not _column_exists('exames', 'created_at'):
        op.add_column('exames', sa.Column('created_at', sa.DateTime, nullable=True))
    
    if not _column_exists('exames', 'updated_at'):
        op.add_column('exames', sa.Column('updated_at', sa.DateTime, nullable=True))
    
    # Atualiza registros existentes com código sequencial
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE exames
            SET
                codigo = 'EX' || LPAD(id::text, 4, '0'),
                ativo = true,
                created_at = COALESCE(created_at, NOW()),
                updated_at = COALESCE(updated_at, NOW())
            WHERE codigo IS NULL
        """)
    )
    
    # Adiciona índices em nome e tipo
    if not _index_exists('exames', 'ix_exames_nome'):
        op.create_index('ix_exames_nome', 'exames', ['nome'])
    
    if not _index_exists('exames', 'ix_exames_tipo'):
        op.create_index('ix_exames_tipo', 'exames', ['tipo'])


def downgrade():
    """Remove os campos adicionados."""
    
    # Remove índices se existirem
    if _index_exists('exames', 'ix_exames_tipo'):
        op.drop_index('ix_exames_tipo', 'exames')
    
    if _index_exists('exames', 'ix_exames_nome'):
        op.drop_index('ix_exames_nome', 'exames')
    
    if _index_exists('exames', 'ix_exames_codigo_parceiro'):
        op.drop_index('ix_exames_codigo_parceiro', 'exames')
    
    if _index_exists('exames', 'ix_exames_codigo'):
        op.drop_index('ix_exames_codigo', 'exames')
    
    # Remove colunas se existirem
    if _column_exists('exames', 'updated_at'):
        op.drop_column('exames', 'updated_at')
    
    if _column_exists('exames', 'created_at'):
        op.drop_column('exames', 'created_at')
    
    if _column_exists('exames', 'ativo'):
        op.drop_column('exames', 'ativo')
    
    if _column_exists('exames', 'valor_venda'):
        op.drop_column('exames', 'valor_venda')
    
    if _column_exists('exames', 'codigo_parceiro'):
        op.drop_column('exames', 'codigo_parceiro')
    
    if _column_exists('exames', 'codigo'):
        op.drop_column('exames', 'codigo')
