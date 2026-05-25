"""create patients

Revision ID: 20260525_0003
Revises: 20260525_0002
Create Date: 2026-05-25 00:03:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260525_0003"
down_revision: str | None = "20260525_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Crie a tabela inicial de pacientes."""

    op.create_table(
        "patients",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("cpf", sa.String(length=11), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "sex",
            sa.String(length=20),
            server_default=sa.text("'not_informed'"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=160), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("address_line", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=2), nullable=True),
        sa.Column("postal_code", sa.String(length=8), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            "sex in ('female', 'male', 'other', 'not_informed')",
            name=op.f("ck_patients_sex_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
    )
    op.create_index(op.f("ix_patients_cpf"), "patients", ["cpf"], unique=True)
    op.create_index(
        op.f("ix_patients_full_name"), "patients", ["full_name"], unique=False
    )


def downgrade() -> None:
    """Remova a tabela inicial de pacientes."""

    op.drop_index(op.f("ix_patients_full_name"), table_name="patients")
    op.drop_index(op.f("ix_patients_cpf"), table_name="patients")
    op.drop_table("patients")
