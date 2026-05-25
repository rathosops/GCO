"""
DevTools Controller (ROLLBACK LEGADO)

No modo legacy-only removemos dependências do auth novo:
- Staff / Role / Permission / RefreshToken / AuditLog (app.models.auth)

Mantemos endpoints mínimos para não quebrar imports/blueprints.
Se você usava endpoints específicos do devtools para o auth novo,
eles agora retornam 501.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

devtools_bp = Blueprint("devtools", __name__, url_prefix="/devtools")


@devtools_bp.route("/health", methods=["GET"])
def health():
    """Health simples do DevTools."""
    return jsonify({"status": "ok", "mode": "legacy-only"}), 200


@devtools_bp.route("/info", methods=["GET"])
def info():
    """Informações básicas úteis no modo legado."""
    return jsonify(
        {
            "mode": "legacy-only",
            "auth": "autenticadores",
            "note": "Auth novo (Staff/Role/Permission/RefreshToken/AuditLog) desabilitado",
        }
    ), 200


# -------------------------------
# Endpoints antigos do auth novo
# -------------------------------

@devtools_bp.route("/auth-stats", methods=["GET"])
def auth_stats():
    """Compatibilidade: stats do auth novo não existem no legado."""
    return (
        jsonify(
            {
                "error": "not_implemented",
                "message": "Recurso do auth novo não disponível no modo legado",
            }
        ),
        501,
    )


@devtools_bp.route("/staff/<int:staff_id>", methods=["GET"])
def staff_debug(staff_id: int):
    """Compatibilidade: debug de Staff não existe no legado."""
    return (
        jsonify(
            {
                "error": "not_implemented",
                "message": "Recurso do auth novo não disponível no modo legado",
            }
        ),
        501,
    )
