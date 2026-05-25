"""merge heads 5560c28f370c + add_exames_fields

Revision ID: 46e67639198f
Revises: 5560c28f370c, add_exames_fields
Create Date: 2026-01-05 12:50:06.997430

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '46e67639198f'
down_revision = ('5560c28f370c', 'add_exames_fields')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
