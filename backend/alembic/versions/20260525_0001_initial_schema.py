"""Create initial V2 schema.

Revision ID: 20260525_0001
Revises:
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply initial schema."""

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role in ('admin', 'operator', 'triage', 'doctor')",
            name=op.f("ck_users_role_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
    )

    op.create_table(
        "rooms",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind in ('office', 'triage', 'reception')",
            name=op.f("ck_rooms_kind_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rooms")),
        sa.UniqueConstraint("code", name=op.f("uq_rooms_code")),
    )

    op.create_table(
        "appointments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_name", sa.String(length=160), nullable=False),
        sa.Column("patient_document", sa.String(length=20), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "requires_triage",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("external_source", sa.String(length=40), nullable=True),
        sa.Column("external_id", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status in ("
            "'waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show'"
            ")",
            name=op.f("ck_appointments_status_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
    )

    op.create_table(
        "panel_settings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_panel_settings")),
        sa.UniqueConstraint("key", name=op.f("uq_panel_settings_key")),
    )

    op.create_table(
        "calls",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("appointment_id", sa.BigInteger(), nullable=False),
        sa.Column("room_id", sa.BigInteger(), nullable=True),
        sa.Column("called_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=180), nullable=True),
        sa.Column("called_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind in ('doctor', 'triage', 'administrative')",
            name=op.f("ck_calls_kind_allowed"),
        ),
        sa.CheckConstraint(
            "status in ("
            "'waiting', 'called', 'in_service', 'completed', 'no_show', 'cancelled'"
            ")",
            name=op.f("ck_calls_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            name=op.f("fk_calls_appointment_id_appointments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["called_by_user_id"],
            ["users.id"],
            name=op.f("fk_calls_called_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["rooms.id"],
            name=op.f("fk_calls_room_id_rooms"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_calls")),
    )

    op.create_table(
        "triage_records",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("appointment_id", sa.BigInteger(), nullable=False),
        sa.Column("triaged_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status in ('pending', 'completed', 'cancelled')",
            name=op.f("ck_triage_records_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            name=op.f("fk_triage_records_appointment_id_appointments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["triaged_by_user_id"],
            ["users.id"],
            name=op.f("fk_triage_records_triaged_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_triage_records")),
        sa.UniqueConstraint(
            "appointment_id",
            name=op.f("uq_triage_records_appointment_id"),
        ),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=80), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_audit_logs_actor_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )

    op.create_index(
        op.f("ix_calls_appointment_id"),
        "calls",
        ["appointment_id"],
        unique=False,
    )
    op.create_index(
        "ix_calls_status_called_at",
        "calls",
        ["status", "called_at"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_scheduled_for_status",
        "appointments",
        ["scheduled_for", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_logs_created_at"),
        "audit_logs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Rollback initial schema."""

    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index("ix_appointments_scheduled_for_status", table_name="appointments")
    op.drop_index("ix_calls_status_called_at", table_name="calls")
    op.drop_index(op.f("ix_calls_appointment_id"), table_name="calls")
    op.drop_table("audit_logs")
    op.drop_table("triage_records")
    op.drop_table("calls")
    op.drop_table("panel_settings")
    op.drop_table("appointments")
    op.drop_table("rooms")
    op.drop_table("users")
