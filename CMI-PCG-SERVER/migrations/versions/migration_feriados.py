"""Add feriados_customizados table

Revision ID: add_feriados_customizados
Revises: <PREVIOUS_REVISION>
Create Date: 2026-02-03

Comando para gerar migration oficial:
    flask db migrate -m "Add feriados_customizados table"
    flask db upgrade

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_feriados_customizados'
down_revision = 'add_conta_destinada_pix'
branch_labels = None
depends_on = None


def upgrade():
    """Cria tabela feriados_customizados."""
    op.create_table(
        'feriados_customizados',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('nome', sa.String(length=200), nullable=False),
        sa.Column('tipo', sa.String(length=50), nullable=False, server_default='CLINICA'),
        sa.Column('bloqueia_agendamento', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('recorrente', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        # Campos de auditoria
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by_id', sa.BigInteger(), nullable=True),
        sa.Column('updated_by_id', sa.BigInteger(), nullable=True),
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('data', 'nome', name='uq_feriado_data_nome'),
    )

    # Índices
    op.create_index('ix_feriados_data_ativo', 'feriados_customizados', ['data', 'ativo'])
    op.create_index('ix_feriados_customizados_data', 'feriados_customizados', ['data'])


def downgrade():
    """Remove tabela feriados_customizados."""
    op.drop_index('ix_feriados_customizados_data', table_name='feriados_customizados')
    op.drop_index('ix_feriados_data_ativo', table_name='feriados_customizados')
    op.drop_table('feriados_customizados')
