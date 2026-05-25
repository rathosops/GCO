"""sync audit_logs with new auth model

Revision ID: ba0ecce20481
Revises: add_auth_columns_v2
Create Date: 2026-01-11 09:29:03.446757

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ba0ecce20481'
down_revision = 'add_auth_columns_v2'
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
