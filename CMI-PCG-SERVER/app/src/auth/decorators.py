"""
Decorators de autenticação e autorização.

Rollback legado:
- current_user é Autenticadores
- Permissões vêm de current_user.has_permission / get_all_permissions
- Hierarquia/Staff management não se aplica (deixamos um stub 501)
"""

from __future__ import annotations

from functools import wraps
from typing import Callable

from flask import jsonify
from flask_jwt_extended import current_user, verify_jwt_in_request


def _require_user():
    if not current_user:
        return (
            jsonify(
                {
                    "error": "unauthorized",
                    "message": "Usuário não encontrado",
                }
            ),
            401,
        )
    if not getattr(current_user, "is_active", True):
        return (
            jsonify(
                {
                    "error": "account_disabled",
                    "message": "Conta desativada",
                }
            ),
            403,
        )
    return None


def require_permission(permission_code: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            err = _require_user()
            if err:
                return err

            if not current_user.has_permission(permission_code):
                return (
                    jsonify(
                        {
                            "error": "forbidden",
                            "message": f"Permissão necessária: {permission_code}",
                            "required_permission": permission_code,
                        }
                    ),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_any_permission(*permission_codes: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            err = _require_user()
            if err:
                return err

            if not current_user.has_any_permission(*permission_codes):
                return (
                    jsonify(
                        {
                            "error": "forbidden",
                            "message": "Permissão insuficiente",
                            "required_permissions": list(permission_codes),
                        }
                    ),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_all_permissions(*permission_codes: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            err = _require_user()
            if err:
                return err

            if not current_user.has_all_permissions(*permission_codes):
                missing = [
                    p for p in permission_codes if not current_user.has_permission(p)
                ]
                return (
                    jsonify(
                        {
                            "error": "forbidden",
                            "message": "Permissões insuficientes",
                            "missing_permissions": missing,
                        }
                    ),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_role(*role_slugs: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            err = _require_user()
            if err:
                return err

            if getattr(current_user, "is_master", False):
                return fn(*args, **kwargs)

            # No legado, "role" é o tipo
            user_role = getattr(current_user, "staff_type", None) or getattr(
                current_user, "tipo", None
            )
            if user_role not in role_slugs:
                return (
                    jsonify(
                        {
                            "error": "forbidden",
                            "message": "Perfil não autorizado para esta ação",
                            "required_roles": list(role_slugs),
                        }
                    ),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_master(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        err = _require_user()
        if err:
            return err

        if not getattr(current_user, "is_master", False):
            return (
                jsonify(
                    {
                        "error": "forbidden",
                        "message": "Acesso restrito ao administrador master",
                    }
                ),
                403,
            )
        return fn(*args, **kwargs)

    return wrapper


def require_hierarchy_above(target_staff_id: int) -> Callable:
    """
    Hierarquia do módulo novo não existe no legado.
    Mantemos stub para não quebrar imports.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            err = _require_user()
            if err:
                return err
            return (
                jsonify(
                    {
                        "error": "not_implemented",
                        "message": "Recurso de hierarquia não disponível no modo legado",
                    }
                ),
                501,
            )

        return wrapper

    return decorator


def permission_check(permission_code: str) -> bool:
    if not current_user:
        return False
    return current_user.has_permission(permission_code)


def get_current_permissions() -> list[str]:
    if not current_user:
        return []
    return current_user.get_all_permissions()
