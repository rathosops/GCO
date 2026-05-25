"""Tests for role-based permission calculation."""

from app.modules.auth.models import UserRole
from app.modules.auth.permissions import (
    Permission,
    has_permissions,
    permissions_for_role,
)


def test_admin_receives_all_permissions() -> None:
    """Administrators keep access to every known permission."""

    permissions = permissions_for_role(UserRole.ADMIN)

    assert Permission.TENANT_MANAGE.value in permissions
    assert Permission.AUDIT_READ.value in permissions


def test_operator_cannot_manage_tenant_profile() -> None:
    """Operational users cannot change white-label settings."""

    permissions = permissions_for_role(UserRole.OPERATOR)

    assert not has_permissions(permissions, [Permission.TENANT_MANAGE])
    assert has_permissions(permissions, [Permission.CALLS_MANAGE])
