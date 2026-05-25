"""
Adiciona tabelas do sistema de autenticação.

Tables:
- staff: Usuários do sistema
- roles: Perfis de acesso
- permissions: Permissões granulares
- role_permissions: N:N roles-permissions
- staff_permissions: Permissões individuais
- refresh_tokens: Controle de sessões
- audit_logs: Log de auditoria

Revision ID: 001_add_auth_tables
Revises: (última migration existente)
Create Date: 2025-01-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = "001_add_auth_tables"
down_revision = None  # Ajuste para a última migration existente
branch_labels = None
depends_on = None


def upgrade():
    # ============================================
    # ROLES
    # ============================================
    op.create_table(
        "roles",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("hierarchy_level", sa.Integer(), nullable=False, default=0),
        sa.Column("is_system", sa.Boolean(), nullable=False, default=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_roles_slug"),
    )
    op.create_index("ix_roles_slug", "roles", ["slug"])

    # ============================================
    # PERMISSIONS
    # ============================================
    op.create_table(
        "permissions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"])
    op.create_index("ix_permissions_module", "permissions", ["module"])

    # ============================================
    # STAFF
    # ============================================
    op.create_table(
        "staff",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("cpf", sa.BigInteger(), nullable=False),
        sa.Column("telefone", sa.String(20), nullable=True),
        sa.Column("staff_type", sa.String(50), nullable=False, default="outro"),
        sa.Column("medico_id", sa.BigInteger(), nullable=True),
        sa.Column("enfermeiro_id", sa.BigInteger(), nullable=True),
        sa.Column("atendente_id", sa.BigInteger(), nullable=True),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_master", sa.Boolean(), nullable=False, default=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("login_attempts", sa.Integer(), nullable=False, default=0),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_extra", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_staff_email"),
        sa.UniqueConstraint("cpf", name="uq_staff_cpf"),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name="fk_staff_role", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["medico_id"], ["medicos.id"], name="fk_staff_medico", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["enfermeiro_id"],
            ["enfermeiros.id"],
            name="fk_staff_enfermeiro",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["atendente_id"],
            ["atendentes.id"],
            name="fk_staff_atendente",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["staff.id"],
            name="fk_staff_created_by",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_staff_email", "staff", ["email"])
    op.create_index("ix_staff_cpf", "staff", ["cpf"])
    op.create_index("ix_staff_role_id", "staff", ["role_id"])
    op.create_index("ix_staff_staff_type", "staff", ["staff_type"])

    # Adiciona FK de roles.created_by para staff (referência circular)
    op.create_foreign_key(
        "fk_roles_created_by",
        "roles",
        "staff",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # ============================================
    # ROLE_PERMISSIONS
    # ============================================
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("permission_id", sa.BigInteger(), nullable=False),
        sa.Column("granted_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles.id"],
            name="fk_role_permissions_role",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions.id"],
            name="fk_role_permissions_permission",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["granted_by"],
            ["staff.id"],
            name="fk_role_permissions_granted_by",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])
    op.create_index(
        "ix_role_permissions_permission_id", "role_permissions", ["permission_id"]
    )

    # ============================================
    # STAFF_PERMISSIONS
    # ============================================
    op.create_table(
        "staff_permissions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("staff_id", sa.BigInteger(), nullable=False),
        sa.Column("permission_id", sa.BigInteger(), nullable=False),
        sa.Column("is_grant", sa.Boolean(), nullable=False, default=True),
        sa.Column("granted_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff.id"],
            name="fk_staff_permissions_staff",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions.id"],
            name="fk_staff_permissions_permission",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["granted_by"],
            ["staff.id"],
            name="fk_staff_permissions_granted_by",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("staff_id", "permission_id", name="uq_staff_permission"),
    )
    op.create_index("ix_staff_permissions_staff_id", "staff_permissions", ["staff_id"])
    op.create_index(
        "ix_staff_permissions_permission_id", "staff_permissions", ["permission_id"]
    )

    # ============================================
    # REFRESH_TOKENS
    # ============================================
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("jti", sa.String(36), nullable=False),
        sa.Column("staff_id", sa.BigInteger(), nullable=False),
        sa.Column("device_info", sa.String(500), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.BigInteger(), nullable=True),
        sa.Column("revoke_reason", sa.String(200), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff.id"],
            name="fk_refresh_tokens_staff",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["revoked_by"],
            ["staff.id"],
            name="fk_refresh_tokens_revoked_by",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"])
    op.create_index("ix_refresh_tokens_staff_id", "refresh_tokens", ["staff_id"])

    # ============================================
    # AUDIT_LOGS
    # ============================================
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("staff_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.BigInteger(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, default=True),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["staff_id"], ["staff.id"], name="fk_audit_logs_staff", ondelete="SET NULL"
        ),
    )
    op.create_index("ix_audit_logs_staff_id", "audit_logs", ["staff_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade():
    # Drop em ordem reversa (respeitando FKs)
    op.drop_table("audit_logs")
    op.drop_table("refresh_tokens")
    op.drop_table("staff_permissions")
    op.drop_table("role_permissions")

    # Remove FK circular antes de dropar staff
    op.drop_constraint("fk_roles_created_by", "roles", type_="foreignkey")

    op.drop_table("staff")
    op.drop_table("permissions")
    op.drop_table("roles")
