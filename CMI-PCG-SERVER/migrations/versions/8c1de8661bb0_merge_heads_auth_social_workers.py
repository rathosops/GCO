"""merge heads auth + social workers

Revision ID: 8c1de8661bb0
Revises: 001_add_auth_tables, add_social_workers
Create Date: 2026-01-29 14:27:57.716503

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8c1de8661bb0'
down_revision = ('001_add_auth_tables', 'add_social_workers')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
