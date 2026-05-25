"""Add missing auth columns to roles and staff tables (IDEMPOTENTE)

Esta migração adiciona as colunas faltantes nos modelos auth:
- roles.created_by, roles.updated_at
- staff.updated_at, staff.created_by
- role_permissions.granted_by, role_permissions.granted_at

IDEMPOTENTE: Verifica se colunas existem antes de criar.

Revision ID: add_auth_columns_v2
Revises: 46e67639198f
Create Date: 2026-01-11
"""

from alembic import op
import sqlalchemy as sa


revision = 'add_auth_columns_v2'
down_revision = '46e67639198f'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Verifica se uma coluna existe na tabela."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        columns = [col['name'] for col in inspector.get_columns(table)]
        return column in columns
    except Exception:
        return False


def _table_exists(table: str) -> bool:
    """Verifica se uma tabela existe."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    return table in inspector.get_table_names()


def _index_exists(table: str, index_name: str) -> bool:
    """Verifica se um índice existe."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    try:
        indexes = [idx['name'] for idx in inspector.get_indexes(table)]
        return index_name in indexes
    except Exception:
        return False


def upgrade() -> None:
    """Adiciona colunas faltantes nas tabelas auth."""
    
    # ========================================
    # Tabela: roles
    # ========================================
    if _table_exists('roles'):
        if not _column_exists('roles', 'created_by'):
            op.add_column(
                'roles',
                sa.Column('created_by', sa.BigInteger(), nullable=True)
            )
            # FK será criada depois que staff existir
        
        if not _column_exists('roles', 'updated_at'):
            op.add_column(
                'roles',
                sa.Column(
                    'updated_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('CURRENT_TIMESTAMP'),
                    nullable=False,
                )
            )
        
        # Índice para created_by
        if _column_exists('roles', 'created_by') and not _index_exists('roles', 'ix_roles_created_by'):
            op.create_index('ix_roles_created_by', 'roles', ['created_by'], unique=False)
    
    # ========================================
    # Tabela: staff
    # ========================================
    if _table_exists('staff'):
        if not _column_exists('staff', 'updated_at'):
            op.add_column(
                'staff',
                sa.Column(
                    'updated_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('CURRENT_TIMESTAMP'),
                    nullable=False,
                )
            )
        
        if not _column_exists('staff', 'created_by'):
            op.add_column(
                'staff',
                sa.Column('created_by', sa.BigInteger(), nullable=True)
            )
        
        # Índice para created_by
        if _column_exists('staff', 'created_by') and not _index_exists('staff', 'ix_staff_created_by'):
            op.create_index('ix_staff_created_by', 'staff', ['created_by'], unique=False)
    
    # ========================================
    # Tabela: role_permissions
    # ========================================
    if _table_exists('role_permissions'):
        if not _column_exists('role_permissions', 'granted_by'):
            op.add_column(
                'role_permissions',
                sa.Column('granted_by', sa.BigInteger(), nullable=True)
            )
        
        if not _column_exists('role_permissions', 'granted_at'):
            op.add_column(
                'role_permissions',
                sa.Column(
                    'granted_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('CURRENT_TIMESTAMP'),
                    nullable=False,
                )
            )
    
    # ========================================
    # Tabela: staff_permissions
    # ========================================
    if _table_exists('staff_permissions'):
        if not _column_exists('staff_permissions', 'granted_by'):
            op.add_column(
                'staff_permissions',
                sa.Column('granted_by', sa.BigInteger(), nullable=True)
            )
        
        if not _column_exists('staff_permissions', 'granted_at'):
            op.add_column(
                'staff_permissions',
                sa.Column(
                    'granted_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('CURRENT_TIMESTAMP'),
                    nullable=False,
                )
            )
        
        if not _column_exists('staff_permissions', 'reason'):
            op.add_column(
                'staff_permissions',
                sa.Column('reason', sa.String(500), nullable=True)
            )


def downgrade() -> None:
    """Remove as colunas adicionadas (rollback)."""
    
    # staff_permissions
    if _table_exists('staff_permissions'):
        if _column_exists('staff_permissions', 'reason'):
            op.drop_column('staff_permissions', 'reason')
        if _column_exists('staff_permissions', 'granted_at'):
            op.drop_column('staff_permissions', 'granted_at')
        if _column_exists('staff_permissions', 'granted_by'):
            op.drop_column('staff_permissions', 'granted_by')
    
    # role_permissions
    if _table_exists('role_permissions'):
        if _column_exists('role_permissions', 'granted_at'):
            op.drop_column('role_permissions', 'granted_at')
        if _column_exists('role_permissions', 'granted_by'):
            op.drop_column('role_permissions', 'granted_by')
    
    # staff
    if _table_exists('staff'):
        if _index_exists('staff', 'ix_staff_created_by'):
            op.drop_index('ix_staff_created_by', table_name='staff')
        if _column_exists('staff', 'created_by'):
            op.drop_column('staff', 'created_by')
        if _column_exists('staff', 'updated_at'):
            op.drop_column('staff', 'updated_at')
    
    # roles
    if _table_exists('roles'):
        if _index_exists('roles', 'ix_roles_created_by'):
            op.drop_index('ix_roles_created_by', table_name='roles')
        if _column_exists('roles', 'created_by'):
            op.drop_column('roles', 'created_by')
        if _column_exists('roles', 'updated_at'):
            op.drop_column('roles', 'updated_at')
