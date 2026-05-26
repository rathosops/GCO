"""create clinical records

Revision ID: 20260526_0004
Revises: 20260525_0003
Create Date: 2026-05-26 00:04:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260526_0004"
down_revision: str | None = "20260525_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Crie a tabela de prontuarios clinicos."""

    op.create_table(
        "clinical_records",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=True),
        sa.Column("appointment_id", sa.Integer(), nullable=True),
        sa.Column("patient_name", sa.String(length=160), nullable=False),
        sa.Column("patient_document", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("history", sa.Text(), nullable=True),
        sa.Column("physical_exam", sa.Text(), nullable=True),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("conduct", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            "status in ('draft', 'finished')",
            name=op.f("ck_clinical_records_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            name=op.f("fk_clinical_records_appointment_id_appointments"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_clinical_records_patient_id_patients"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clinical_records")),
    )
    op.create_index(
        op.f("ix_clinical_records_appointment_id"),
        "clinical_records",
        ["appointment_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_clinical_records_patient_id"),
        "clinical_records",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_clinical_records_status"),
        "clinical_records",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    """Remova a tabela de prontuarios clinicos."""

    op.drop_index(op.f("ix_clinical_records_status"), table_name="clinical_records")
    op.drop_index(
        op.f("ix_clinical_records_patient_id"),
        table_name="clinical_records",
    )
    op.drop_index(
        op.f("ix_clinical_records_appointment_id"),
        table_name="clinical_records",
    )
    op.drop_table("clinical_records")
