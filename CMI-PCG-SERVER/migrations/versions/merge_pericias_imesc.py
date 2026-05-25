"""merge pericias_imesc with main branch

Revision ID: merge_pericias_imesc
Revises: add_pericias_imesc, c00993aab464
Create Date: 2025-01-26
"""

from alembic import op
import sqlalchemy as sa

revision = 'merge_pericias_imesc'
down_revision = ('add_pericias_imesc', 'c00993aab464')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass