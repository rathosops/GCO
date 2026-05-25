"""create tenant profiles

Revision ID: 20260525_0002
Revises: 20260525_0001
Create Date: 2026-05-25 00:02:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260525_0002"
down_revision: str | None = "20260525_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the singleton white-label clinic profile table."""

    op.create_table(
        "tenant_profiles",
        sa.Column("id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("trade_name", sa.String(length=120), nullable=False),
        sa.Column("legal_name", sa.String(length=160), nullable=True),
        sa.Column("document", sa.String(length=14), nullable=True),
        sa.Column("email", sa.String(length=160), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("address_line", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=2), nullable=True),
        sa.Column("postal_code", sa.String(length=8), nullable=True),
        sa.Column("logo_url", sa.String(length=300), nullable=True),
        sa.Column("primary_color", sa.String(length=20), nullable=True),
        sa.Column(
            "timezone",
            sa.String(length=80),
            server_default=sa.text("'America/Sao_Paulo'"),
            nullable=False,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "id = 1", name=op.f("ck_tenant_profiles_tenant_profile_singleton")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tenant_profiles")),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO tenant_profiles (
                id, trade_name, timezone, is_active
            ) VALUES (
                1, 'Clinica', 'America/Sao_Paulo', true
            )
            """
        )
    )


def downgrade() -> None:
    """Drop the singleton white-label clinic profile table."""

    op.drop_table("tenant_profiles")
