"""Testes do calculo de permissoes por papel."""

from app.modules.auth.models import UserRole
from app.modules.auth.permissions import (
    Permission,
    has_permissions,
    permissions_for_role,
)


def test_admin_receives_all_permissions() -> None:
    """Administradores recebem todas as permissoes conhecidas."""

    permissions = permissions_for_role(UserRole.ADMIN)

    assert Permission.TENANT_MANAGE.value in permissions
    assert Permission.PATIENTS_WRITE.value in permissions
    assert Permission.AUDIT_READ.value in permissions


def test_operator_cannot_manage_tenant_profile() -> None:
    """Usuarios operacionais nao alteram configuracoes white-label."""

    permissions = permissions_for_role(UserRole.OPERATOR)

    assert not has_permissions(permissions, [Permission.TENANT_MANAGE])
    assert has_permissions(permissions, [Permission.CALLS_MANAGE])
