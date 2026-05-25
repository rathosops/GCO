"""Adiciona tabela assistentes_sociais e coluna cress_assistente em pericias_imesc.

Revision ID: add_social_workers
Revises: 21cae2a12cd5
Create Date: 2025-01-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'add_social_workers'
down_revision = '21cae2a12cd5'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Verifica se uma coluna existe na tabela."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def _table_exists(table_name: str) -> bool:
    """Verifica se uma tabela existe."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade():
    # Criar tabela assistentes_sociais (se não existir)
    if not _table_exists('assistentes_sociais'):
        op.create_table(
            'assistentes_sociais',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('nome', sa.String(), nullable=False),
            sa.Column('data_de_nascimento', sa.Date(), nullable=False),
            sa.Column('cpf', sa.String(length=11), nullable=False),
            sa.Column('cress', sa.String(length=20), nullable=False),
            sa.Column('sexo', sa.String(length=1), nullable=False),
            sa.Column('telefone', sa.BigInteger(), nullable=True),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_assistentes_sociais_cpf', 'assistentes_sociais', ['cpf'], unique=True)
        op.create_index('ix_assistentes_sociais_cress', 'assistentes_sociais', ['cress'], unique=True)

    # Adicionar coluna cress_assistente em pericias_imesc (se não existir)
    if not _column_exists('pericias_imesc', 'cress_assistente'):
        op.add_column(
            'pericias_imesc',
            sa.Column('cress_assistente', sa.String(length=20), nullable=True)
        )
        op.create_index('ix_pericias_imesc_cress_assistente', 'pericias_imesc', ['cress_assistente'])
        op.create_foreign_key(
            'fk_pericias_imesc_cress_assistente',
            'pericias_imesc',
            'assistentes_sociais',
            ['cress_assistente'],
            ['cress']
        )

    # Remover coluna staff_parecer_social_id (legado) - se existir
    if _column_exists('pericias_imesc', 'staff_parecer_social_id'):
        op.drop_column('pericias_imesc', 'staff_parecer_social_id')


def downgrade():
    # Adicionar coluna staff_parecer_social_id de volta
    if not _column_exists('pericias_imesc', 'staff_parecer_social_id'):
        op.add_column(
            'pericias_imesc',
            sa.Column('staff_parecer_social_id', sa.BigInteger(), nullable=True)
        )

    # Remover FK e coluna cress_assistente
    if _column_exists('pericias_imesc', 'cress_assistente'):
        op.drop_constraint('fk_pericias_imesc_cress_assistente', 'pericias_imesc', type_='foreignkey')
        op.drop_index('ix_pericias_imesc_cress_assistente', table_name='pericias_imesc')
        op.drop_column('pericias_imesc', 'cress_assistente')

    # Remover tabela assistentes_sociais
    if _table_exists('assistentes_sociais'):
        op.drop_index('ix_assistentes_sociais_cress', table_name='assistentes_sociais')
        op.drop_index('ix_assistentes_sociais_cpf', table_name='assistentes_sociais')
        op.drop_table('assistentes_sociais')