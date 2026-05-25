"""recreate audit_logs legacy safe

Remove FK para staff.id e adiciona campos desnormalizados
(user_id, user_nome, user_type) para funcionar com Autenticadores.

Revision ID: recreate_audit_logs_legacy
Revises: add_stock_management
Create Date: 2026-02-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "recreate_audit_logs_legacy"
down_revision = "add_prescriptions"
branch_labels = None
depends_on = None


def upgrade():
    """Recria tabela audit_logs sem dependência do auth novo."""

    # Drop tabela antiga (se existir) — pode ter FK para staff
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        # Quem (desnormalizado, sem FK)
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("user_nome", sa.String(255), nullable=True),
        sa.Column("user_type", sa.String(50), nullable=True),
        # O que
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(50), nullable=True),
        # Contexto
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        # Detalhes (JSONB)
        sa.Column("details", JSONB(), nullable=False, server_default="{}"),
        # Timestamp
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Índices simples
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # Índices compostos
    op.create_index(
        "ix_audit_logs_resource_action", "audit_logs", ["resource", "action"]
    )
    op.create_index(
        "ix_audit_logs_user_created", "audit_logs", ["user_id", "created_at"]
    )


def downgrade():
    """Remove tabela audit_logs."""
    op.drop_index("ix_audit_logs_user_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
