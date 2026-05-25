"""
Módulo de autenticação e autorização (LEGADO / compatibilidade).

Exporta:
- AuthService (legacy-only)
- Decorators (@require_permission, etc.)
- Utils (hash/verify/sanitize)
- Constants (permissões, etc.)
"""

from app.src.auth.service import AuthService
from app.src.auth.decorators import (
    require_permission,
    require_any_permission,
    require_all_permissions,
    require_role,
    require_master,
    require_hierarchy_above,
    permission_check,
    get_current_permissions,
)
from app.src.auth.utils import (
    hash_password,
    verify_password,
    validate_password,  # mantido, embora não usado no rollback
    generate_temp_password,
    validate_cpf,
    clean_cpf,
    format_cpf,
    sanitize_email,
    get_client_ip,
    get_device_info,
    utc_now,
)
from app.src.auth.constants import (
    StaffType,
    AuditAction,
    PERMISSIONS,
    DEFAULT_ROLES,
    get_permission_modules,
    get_permissions_by_module,
    expand_permission_wildcards,
)

__all__ = [
    "AuthService",
    "require_permission",
    "require_any_permission",
    "require_all_permissions",
    "require_role",
    "require_master",
    "require_hierarchy_above",
    "permission_check",
    "get_current_permissions",
    "hash_password",
    "verify_password",
    "validate_password",
    "generate_temp_password",
    "validate_cpf",
    "clean_cpf",
    "format_cpf",
    "sanitize_email",
    "get_client_ip",
    "get_device_info",
    "utc_now",
    "StaffType",
    "AuditAction",
    "PERMISSIONS",
    "DEFAULT_ROLES",
    "get_permission_modules",
    "get_permissions_by_module",
    "expand_permission_wildcards",
]
