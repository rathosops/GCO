# app/utils/jwt_guard.py
"""
JWT Guard para blueprints.

Aplica verificação de JWT automaticamente:
- require_jwt_for_writes: JWT em POST/PUT/PATCH/DELETE, GETs abertos.
- require_master_for_all: JWT + master em TODOS os métodos HTTP.

Uso:
    from app.utils.jwt_guard import require_jwt_for_writes, require_master_for_all
    require_jwt_for_writes(minha_bp)
    require_master_for_all(despesas_bp)
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, verify_jwt_in_request


# Métodos HTTP que exigem autenticação
_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def require_jwt_for_writes(bp: Blueprint) -> None:
    """
    Registra before_request hook que exige JWT em métodos de escrita.

    GET/HEAD/OPTIONS passam sem autenticação.
    POST/PUT/PATCH/DELETE exigem Bearer token válido.
    """

    @bp.before_request
    def _check_jwt_on_write():
        if request.method in _WRITE_METHODS:
            verify_jwt_in_request()


def require_master_for_all(bp: Blueprint) -> None:
    """
    Registra before_request que exige JWT + master em TODOS os métodos.

    Qualquer requisição (GET, POST, PUT, etc.) só passa se:
    1. Token JWT válido presente
    2. Usuário é master (admin)

    Ideal para módulos restritos (ex: despesas, admin panel).
    """

    @bp.before_request
    def _check_master_all_methods():
        verify_jwt_in_request()

        if not current_user:
            return jsonify({"error": "Usuário não encontrado"}), 401

        if not getattr(current_user, "is_master", False):
            return (
                jsonify({"error": "Acesso restrito ao administrador master"}),
                403,
            )
