"""Adiciona campo conta_destinada_pix na tabela pagamentos

Revision ID: add_conta_destinada_pix
Revises: [AJUSTE_REVISION_ANTERIOR]
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_conta_destinada_pix'
down_revision = '8c1de8661bb0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'pagamentos',
        sa.Column('conta_destinada_pix', sa.String(2), nullable=True)
    )


def downgrade():
    op.drop_column('pagamentos', 'conta_destinada_pix')