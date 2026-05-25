# app/control/devtools_auth_debug.py
"""
Devtools: endpoints de debug para autenticação.

Registrado como sub-blueprint ou adicionado ao devtools existente.
Acesso sem JWT (mesma política do devtools).

Endpoints:
    GET /devtools/auth/debug           → Lista todos os autenticadores (sem senha)
    GET /devtools/auth/debug/<usuario>  → Detalhe de um autenticador
    GET /devtools/auth/summary         → Resumo de autenticação
"""

from __future__ import annotations

from flask import Blueprint, jsonify
from sqlalchemy import func

from app.database import db
from app.models.auth_model import Autenticadores

devtools_auth_bp = Blueprint("devtools_auth", __name__, url_prefix="/devtools/auth")


@devtools_auth_bp.route("/debug", methods=["GET"])
def debug_all_users():
    """Lista todos os autenticadores com detalhes de debug (sem senha)."""
    users = Autenticadores.query.order_by(
        Autenticadores.tipo, Autenticadores.usuario
    ).all()

    return jsonify(
        {
            "total": len(users),
            "users": [
                {
                    "id": u.id,
                    "usuario": u.usuario,
                    "tipo": u.tipo,
                    "tipo_repr": repr(u.tipo),
                    "is_master": u.is_master,
                    "is_master_check": u.tipo == "admin",
                    "senha_format": (
                        "argon2"
                        if (u.senha or "").startswith("$argon2")
                        else "plaintext"
                    ),
                    "permissions_count": len(u.get_all_permissions()),
                }
                for u in users
            ],
        }
    )


@devtools_auth_bp.route("/debug/<string:usuario>", methods=["GET"])
def debug_user(usuario: str):
    """Detalhe de debug de um autenticador específico."""
    user = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario.strip().lower()
    ).first()

    if not user:
        return jsonify({"error": f"Usuário '{usuario}' não encontrado"}), 404

    return jsonify(
        {
            "id": user.id,
            "usuario": user.usuario,
            "tipo": user.tipo,
            "tipo_repr": repr(user.tipo),
            "tipo_bytes": [hex(ord(c)) for c in (user.tipo or "")],
            "is_master": user.is_master,
            "is_master_check": user.tipo == "admin",
            "is_active": user.is_active,
            "senha_format": (
                "argon2" if (user.senha or "").startswith("$argon2") else "plaintext"
            ),
            "to_dict_is_master": user.to_dict().get("is_master"),
            "jwt_identity": user.to_jwt_identity(),
            "permissions": user.get_all_permissions(),
        }
    )


@devtools_auth_bp.route("/summary", methods=["GET"])
def auth_summary():
    """Resumo de autenticação para dashboard."""
    by_tipo = (
        db.session.query(
            Autenticadores.tipo,
            func.count(Autenticadores.id),
        )
        .group_by(Autenticadores.tipo)
        .all()
    )

    total = sum(c for _, c in by_tipo)
    masters = sum(c for t, c in by_tipo if t == "admin")

    return jsonify(
        {
            "staff_total": total,
            "staff_active": total,
            "staff_locked": 0,
            "staff_masters": masters,
            "roles": len(by_tipo),
            "permissions": 0,
            "active_refresh_tokens": 0,
            "by_tipo": [{"tipo": t, "count": c} for t, c in by_tipo],
            "recent_failed_logins": [],
        }
    )
