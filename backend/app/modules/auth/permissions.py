"""Permissoes granulares calculadas a partir dos papeis atuais."""

from collections.abc import Iterable
from enum import StrEnum

from app.modules.auth.models import UserRole


class Permission(StrEnum):
    """Permissoes conhecidas pela V2 inicial."""

    TENANT_READ = "tenant.read"
    TENANT_MANAGE = "tenant.manage"
    APPOINTMENTS_READ = "appointments.read"
    APPOINTMENTS_MANAGE = "appointments.manage"
    PATIENTS_READ = "patients.read"
    PATIENTS_WRITE = "patients.write"
    CALLS_READ = "calls.read"
    CALLS_MANAGE = "calls.manage"
    ROOMS_READ = "rooms.read"
    ROOMS_MANAGE = "rooms.manage"
    TRIAGE_READ = "triage.read"
    TRIAGE_MANAGE = "triage.manage"
    PANEL_VIEW = "panel.view"
    AUDIT_READ = "audit.read"


ROLE_PERMISSIONS: dict[UserRole, tuple[Permission, ...]] = {
    UserRole.ADMIN: tuple(Permission),
    UserRole.OPERATOR: (
        Permission.TENANT_READ,
        Permission.APPOINTMENTS_READ,
        Permission.APPOINTMENTS_MANAGE,
        Permission.PATIENTS_READ,
        Permission.PATIENTS_WRITE,
        Permission.CALLS_READ,
        Permission.CALLS_MANAGE,
        Permission.ROOMS_READ,
        Permission.ROOMS_MANAGE,
        Permission.PANEL_VIEW,
    ),
    UserRole.TRIAGE: (
        Permission.TENANT_READ,
        Permission.APPOINTMENTS_READ,
        Permission.PATIENTS_READ,
        Permission.CALLS_READ,
        Permission.ROOMS_READ,
        Permission.TRIAGE_READ,
        Permission.TRIAGE_MANAGE,
        Permission.PANEL_VIEW,
    ),
    UserRole.DOCTOR: (
        Permission.TENANT_READ,
        Permission.APPOINTMENTS_READ,
        Permission.PATIENTS_READ,
        Permission.CALLS_READ,
        Permission.ROOMS_READ,
        Permission.PANEL_VIEW,
    ),
}


def normalize_permission(permission: Permission | str) -> str:
    """Return the persisted string value of a permission."""

    return permission.value if isinstance(permission, Permission) else permission


def permissions_for_role(role: UserRole) -> list[str]:
    """Return sorted permission values for one role."""

    return sorted(permission.value for permission in ROLE_PERMISSIONS.get(role, ()))


def has_permissions(
    available: Iterable[Permission | str],
    required: Iterable[Permission | str],
) -> bool:
    """Return whether all required permissions are present."""

    available_values = {normalize_permission(permission) for permission in available}
    required_values = {normalize_permission(permission) for permission in required}
    return required_values.issubset(available_values)
