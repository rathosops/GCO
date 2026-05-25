"""
Modelos de autenticação e controle de acesso.

Exporta:
- Staff: Usuários do sistema
- Role: Perfis de acesso
- Permission: Permissões granulares
- RolePermission: N:N entre Role e Permission
- StaffPermission: Permissões individuais por usuário
- RefreshToken: Controle de sessões
- AuditLog: Log de auditoria (LEGACY-SAFE, sem FK para staff)
"""

from app.models.auth.staff_model import Staff
from app.models.auth.role_model import Role
from app.models.auth.permission_model import Permission
from app.models.auth.role_permission_model import RolePermission, StaffPermission
from app.models.auth.refresh_token_model import RefreshToken
from app.models.auth.audit_log_model import AuditLog

__all__ = [
    "Staff",
    "Role",
    "Permission",
    "RolePermission",
    "StaffPermission",
    "RefreshToken",
    "AuditLog",
]
