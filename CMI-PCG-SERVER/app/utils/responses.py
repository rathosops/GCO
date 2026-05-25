"""
Helpers padronizados de resposta HTTP para controllers.

DRY: Evita duplicação de _json_error / _json_success em cada controller.
Uso: from app.utils.responses import json_error, json_success, get_pagination
"""

from __future__ import annotations

from typing import Any

from flask import jsonify, request


# ── Constantes de paginação ──────────────────────────────────────────────
DEFAULT_LIMIT = 50
MAX_LIMIT = 500


def json_error(message: str, status_code: int = 400) -> tuple:
    """Retorna resposta de erro padronizada."""
    return jsonify({"error": message}), status_code


def json_success(
    message: str,
    data: Any = None,
    status_code: int = 200,
) -> tuple:
    """Retorna resposta de sucesso padronizada."""
    response: dict[str, Any] = {"message": message}
    if data is not None:
        response["data"] = data
    return jsonify(response), status_code


def get_pagination(
    args: dict | None = None,
    *,
    default_limit: int = DEFAULT_LIMIT,
    max_limit: int = MAX_LIMIT,
) -> tuple[int, int]:
    """
    Extrai e valida limit/offset de query params.

    Returns:
        (limit, offset) já sanitizados.
    """
    if args is None:
        args = request.args

    try:
        limit = min(int(args.get("limit", default_limit)), max_limit)
    except (TypeError, ValueError):
        limit = default_limit

    try:
        offset = max(int(args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        offset = 0

    return limit, offset


def safe_int(value: Any, *, default: int | None = None) -> int | None:
    """Converte value em int de forma segura."""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
