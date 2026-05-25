"""add pericias_imesc table

Revision ID: add_pericias_imesc
Revises: merge_all_heads
Create Date: 2025-01-26
"""

from alembic import op
import sqlalchemy as sa

revision = 'add_pericias_imesc'
down_revision = 'bootstrap_auth_v2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'pericias_imesc',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('protocolo', sa.String(40), nullable=False),
        sa.Column('cpf_paciente', sa.String(11), nullable=False),
        sa.Column('crm_medico', sa.BigInteger(), nullable=True),
        sa.Column('data_pericia', sa.Date(), nullable=False),
        sa.Column('hora_pericia', sa.Time(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='aguardando_triagem'),
        sa.Column('parecer_social', sa.Text(), nullable=True),
        sa.Column('data_parecer_social', sa.DateTime(timezone=True), nullable=True),
        sa.Column('staff_parecer_social_id', sa.BigInteger(), nullable=True),
        sa.Column('parecer_medico', sa.Text(), nullable=True),
        sa.Column('conclusao_medica', sa.String(500), nullable=True),
        sa.Column('cid', sa.String(10), nullable=True),
        sa.Column('data_parecer_medico', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by_id', sa.BigInteger(), nullable=True),
        sa.Column('updated_by_id', sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cpf_paciente'], ['pacientes.cpf'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['crm_medico'], ['medicos.crm'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['staff_parecer_social_id'], ['staff.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['staff.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['staff.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_pericias_imesc_protocolo', 'pericias_imesc', ['protocolo'])
    op.create_index('ix_pericias_imesc_cpf_paciente', 'pericias_imesc', ['cpf_paciente'])
    op.create_index('ix_pericias_imesc_crm_medico', 'pericias_imesc', ['crm_medico'])
    op.create_index('ix_pericias_imesc_data_pericia', 'pericias_imesc', ['data_pericia'])
    op.create_index('ix_pericias_imesc_status', 'pericias_imesc', ['status'])


def downgrade():
    op.drop_index('ix_pericias_imesc_status', table_name='pericias_imesc')
    op.drop_index('ix_pericias_imesc_data_pericia', table_name='pericias_imesc')
    op.drop_index('ix_pericias_imesc_crm_medico', table_name='pericias_imesc')
    op.drop_index('ix_pericias_imesc_cpf_paciente', table_name='pericias_imesc')
    op.drop_index('ix_pericias_imesc_protocolo', table_name='pericias_imesc')
    op.drop_table('pericias_imesc')