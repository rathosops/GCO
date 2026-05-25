"""bootstrap auth v2 (schema-only)

Revision ID: bootstrap_auth_v2
Revises: merge_pericias_imesc
Create Date: 2026-01-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "bootstrap_auth_v2"
down_revision = "merge_all_heads"
branch_labels = None
depends_on = None


def upgrade():
    # 1) roles (sem created_by por causa do ciclo com staff)
    op.create_table(
        "roles",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("hierarchy_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("slug", name="uq_roles_slug"),
    )
    op.create_index("ix_roles_slug", "roles", ["slug"])

    # 2) staff
    op.create_table(
        "staff",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),

        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("senha_hash", sa.String(length=255), nullable=False),

        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("cpf", sa.BigInteger(), nullable=False),
        sa.Column("telefone", sa.String(length=20), nullable=True),

        sa.Column("staff_type", sa.String(length=50), nullable=False, server_default="outro"),

        sa.Column("medico_id", sa.BigInteger(), nullable=True),
        sa.Column("enfermeiro_id", sa.BigInteger(), nullable=True),
        sa.Column("atendente_id", sa.BigInteger(), nullable=True),

        sa.Column("role_id", sa.BigInteger(), nullable=False),

        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_master", sa.Boolean(), nullable=False, server_default=sa.text("false")),

        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),

        sa.Column("metadata_extra", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.BigInteger(), nullable=True),

        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT", name="fk_staff_role_id_roles"),
        sa.ForeignKeyConstraint(["medico_id"], ["medicos.id"], ondelete="SET NULL", name="fk_staff_medico_id_medicos"),
        sa.ForeignKeyConstraint(["enfermeiro_id"], ["enfermeiros.id"], ondelete="SET NULL", name="fk_staff_enfermeiro_id_enfermeiros"),
        sa.ForeignKeyConstraint(["atendente_id"], ["atendentes.id"], ondelete="SET NULL", name="fk_staff_atendente_id_atendentes"),
        sa.ForeignKeyConstraint(["created_by"], ["staff.id"], ondelete="SET NULL", name="fk_staff_created_by_staff"),

        sa.UniqueConstraint("email", name="uq_staff_email"),
        sa.UniqueConstraint("cpf", name="uq_staff_cpf"),
    )
    op.create_index("ix_staff_email", "staff", ["email"])
    op.create_index("ix_staff_cpf", "staff", ["cpf"])
    op.create_index("ix_staff_staff_type", "staff", ["staff_type"])
    op.create_index("ix_staff_role_id", "staff", ["role_id"])

    # 3) Agora que staff existe, adiciona roles.created_by (coluna + FK)
    with op.batch_alter_table("roles") as batch_op:
        batch_op.add_column(sa.Column("created_by", sa.BigInteger(), nullable=True))
        batch_op.create_foreign_key(
            "fk_roles_created_by_staff",
            "staff",
            ["created_by"],
            ["id"],
            ondelete="SET NULL",
        )

    # 4) permissions
    op.create_table(
        "permissions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"])
    op.create_index("ix_permissions_module", "permissions", ["module"])

    # 5) role_permissions
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("permission_id", sa.BigInteger(), nullable=False),
        sa.Column("granted_by", sa.BigInteger(), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),

        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE", name="fk_role_permissions_role_id_roles"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE", name="fk_role_permissions_permission_id_permissions"),
        sa.ForeignKeyConstraint(["granted_by"], ["staff.id"], ondelete="SET NULL", name="fk_role_permissions_granted_by_staff"),

        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])
    op.create_index("ix_role_permissions_permission_id", "role_permissions", ["permission_id"])

    # 6) staff_permissions
    op.create_table(
        "staff_permissions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("staff_id", sa.BigInteger(), nullable=False),
        sa.Column("permission_id", sa.BigInteger(), nullable=False),
        sa.Column("is_grant", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("granted_by", sa.BigInteger(), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("reason", sa.String(length=500), nullable=True),

        sa.ForeignKeyConstraint(["staff_id"], ["staff.id"], ondelete="CASCADE", name="fk_staff_permissions_staff_id_staff"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE", name="fk_staff_permissions_permission_id_permissions"),
        sa.ForeignKeyConstraint(["granted_by"], ["staff.id"], ondelete="SET NULL", name="fk_staff_permissions_granted_by_staff"),

        sa.UniqueConstraint("staff_id", "permission_id", name="uq_staff_permission"),
    )
    op.create_index("ix_staff_permissions_staff_id", "staff_permissions", ["staff_id"])
    op.create_index("ix_staff_permissions_permission_id", "staff_permissions", ["permission_id"])

    # 7) refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("staff_id", sa.BigInteger(), nullable=False),
        sa.Column("device_info", sa.String(length=500), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.BigInteger(), nullable=True),
        sa.Column("revoke_reason", sa.String(length=200), nullable=True),

        sa.ForeignKeyConstraint(["staff_id"], ["staff.id"], ondelete="CASCADE", name="fk_refresh_tokens_staff_id_staff"),
        sa.ForeignKeyConstraint(["revoked_by"], ["staff.id"], ondelete="SET NULL", name="fk_refresh_tokens_revoked_by_staff"),

        sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
    )
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"])
    op.create_index("ix_refresh_tokens_staff_id", "refresh_tokens", ["staff_id"])

    # 8) audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("staff_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("resource", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.BigInteger(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),

        sa.ForeignKeyConstraint(["staff_id"], ["staff.id"], ondelete="SET NULL", name="fk_audit_logs_staff_id_staff"),
    )
    op.create_index("ix_audit_logs_staff_id", "audit_logs", ["staff_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource"])


def downgrade():
    # Ordem reversa por dependências
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_staff_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_refresh_tokens_staff_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_jti", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("ix_staff_permissions_permission_id", table_name="staff_permissions")
    op.drop_index("ix_staff_permissions_staff_id", table_name="staff_permissions")
    op.drop_table("staff_permissions")

    op.drop_index("ix_role_permissions_permission_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")

    op.drop_index("ix_permissions_module", table_name="permissions")
    op.drop_index("ix_permissions_code", table_name="permissions")
    op.drop_table("permissions")

    # remover FK e coluna roles.created_by antes de dropar roles/staff
    with op.batch_alter_table("roles") as batch_op:
        batch_op.drop_constraint("fk_roles_created_by_staff", type_="foreignkey")
        batch_op.drop_column("created_by")

    op.drop_index("ix_staff_role_id", table_name="staff")
    op.drop_index("ix_staff_staff_type", table_name="staff")
    op.drop_index("ix_staff_cpf", table_name="staff")
    op.drop_index("ix_staff_email", table_name="staff")
    op.drop_table("staff")

    op.drop_index("ix_roles_slug", table_name="roles")
    op.drop_table("roles")
