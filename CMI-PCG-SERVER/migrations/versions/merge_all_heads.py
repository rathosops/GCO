"""merge heads

Revision ID: merge_all_heads
Revises: 5edbcd6edcce, ba0ecce20481
Create Date: 2026-01-25

"""
from alembic import op
import sqlalchemy as sa

revision = 'merge_all_heads'
down_revision = ('5edbcd6edcce', 'ba0ecce20481')
branch_labels = None
depends_on = None

def upgrade():
    pass

def downgrade():
    pass
