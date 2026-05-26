"""complete phase k clinical operation

Revision ID: 20260526_0005
Revises: 20260526_0004
Create Date: 2026-05-26 00:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260526_0005"
down_revision: str | None = "20260526_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Aplique as tabelas finais da Fase K."""

    op.add_column(
        "appointments", sa.Column("patient_id", sa.BigInteger(), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_appointments_patient_id_patients"),
        "appointments",
        "patients",
        ["patient_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_appointments_patient_id"),
        "appointments",
        ["patient_id"],
        unique=False,
    )

    op.create_table(
        "prescriptions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=True),
        sa.Column("clinical_record_id", sa.BigInteger(), nullable=True),
        sa.Column("patient_name", sa.String(length=160), nullable=False),
        sa.Column("patient_document", sa.String(length=20), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
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
            "kind in ('simple', 'special_control', 'antimicrobial')",
            name=op.f("ck_prescriptions_kind_allowed"),
        ),
        sa.CheckConstraint(
            "status in ('active', 'cancelled', 'dispensed')",
            name=op.f("ck_prescriptions_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["clinical_record_id"],
            ["clinical_records.id"],
            name=op.f("fk_prescriptions_clinical_record_id_clinical_records"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_prescriptions_patient_id_patients"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prescriptions")),
    )
    op.create_index(
        op.f("ix_prescriptions_clinical_record_id"),
        "prescriptions",
        ["clinical_record_id"],
    )
    op.create_index(
        op.f("ix_prescriptions_patient_id"), "prescriptions", ["patient_id"]
    )
    op.create_index(op.f("ix_prescriptions_status"), "prescriptions", ["status"])

    op.create_table(
        "prescription_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("prescription_id", sa.BigInteger(), nullable=False),
        sa.Column("medication_name", sa.String(length=180), nullable=False),
        sa.Column("dosage", sa.String(length=120), nullable=True),
        sa.Column("route", sa.String(length=80), nullable=True),
        sa.Column("frequency", sa.String(length=120), nullable=True),
        sa.Column("duration", sa.String(length=120), nullable=True),
        sa.Column("quantity", sa.String(length=80), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["prescription_id"],
            ["prescriptions.id"],
            name=op.f("fk_prescription_items_prescription_id_prescriptions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prescription_items")),
    )
    op.create_index(
        op.f("ix_prescription_items_prescription_id"),
        "prescription_items",
        ["prescription_id"],
    )

    op.create_table(
        "exam_requests",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=True),
        sa.Column("clinical_record_id", sa.BigInteger(), nullable=True),
        sa.Column("patient_name", sa.String(length=160), nullable=False),
        sa.Column("patient_document", sa.String(length=20), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
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
            "status in ('pending', 'billed', 'external', 'cancelled')",
            name=op.f("ck_exam_requests_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["clinical_record_id"],
            ["clinical_records.id"],
            name=op.f("fk_exam_requests_clinical_record_id_clinical_records"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_exam_requests_patient_id_patients"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exam_requests")),
    )
    op.create_index(
        op.f("ix_exam_requests_clinical_record_id"),
        "exam_requests",
        ["clinical_record_id"],
    )
    op.create_index(
        op.f("ix_exam_requests_patient_id"), "exam_requests", ["patient_id"]
    )
    op.create_index(op.f("ix_exam_requests_status"), "exam_requests", ["status"])

    op.create_table(
        "exam_request_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("exam_request_id", sa.BigInteger(), nullable=False),
        sa.Column("exam_name", sa.String(length=180), nullable=False),
        sa.Column("exam_code", sa.String(length=60), nullable=True),
        sa.Column("exam_type", sa.String(length=80), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["exam_request_id"],
            ["exam_requests.id"],
            name=op.f("fk_exam_request_items_exam_request_id_exam_requests"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exam_request_items")),
    )
    op.create_index(
        op.f("ix_exam_request_items_request_id"),
        "exam_request_items",
        ["exam_request_id"],
    )


def downgrade() -> None:
    """Remova as tabelas finais da Fase K."""

    op.drop_index(
        op.f("ix_exam_request_items_request_id"), table_name="exam_request_items"
    )
    op.drop_table("exam_request_items")
    op.drop_index(op.f("ix_exam_requests_status"), table_name="exam_requests")
    op.drop_index(op.f("ix_exam_requests_patient_id"), table_name="exam_requests")
    op.drop_index(
        op.f("ix_exam_requests_clinical_record_id"),
        table_name="exam_requests",
    )
    op.drop_table("exam_requests")
    op.drop_index(
        op.f("ix_prescription_items_prescription_id"),
        table_name="prescription_items",
    )
    op.drop_table("prescription_items")
    op.drop_index(op.f("ix_prescriptions_status"), table_name="prescriptions")
    op.drop_index(op.f("ix_prescriptions_patient_id"), table_name="prescriptions")
    op.drop_index(
        op.f("ix_prescriptions_clinical_record_id"),
        table_name="prescriptions",
    )
    op.drop_table("prescriptions")
    op.drop_index(op.f("ix_appointments_patient_id"), table_name="appointments")
    op.drop_constraint(
        op.f("fk_appointments_patient_id_patients"),
        "appointments",
        type_="foreignkey",
    )
    op.drop_column("appointments", "patient_id")
