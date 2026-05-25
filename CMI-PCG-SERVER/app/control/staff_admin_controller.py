# app/control/staff_admin_controller.py
"""
Controller Admin de Usuários.

Painel administrativo estilo Django Admin para gestão de usuários
e níveis de acesso. Somente master tem acesso (via require_master_for_all).

Endpoints:
    GET    /admin/users              → Listar todos os usuários
    GET    /admin/users/tipos        → Listar tipos disponíveis
    GET    /admin/users/<id>         → Detalhe de um usuário
    PUT    /admin/users/<id>         → Atualizar tipo/dados de um usuário
    POST   /admin/users              → Criar novo usuário
    DELETE /admin/users/<id>         → Excluir usuário
    GET    /admin/users/stats        → Estatísticas de usuários
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.auth_model import Autenticadores
from app.src.auth.utils import hash_password
from app.utils.validators import normalize_string

staff_admin_bp = Blueprint("staff_admin", __name__, url_prefix="/admin")


# ── Tipos válidos de usuário ─────────────────────────────────────────────

TIPOS_USUARIO = {
    "admin": {
        "label": "Administrador (Master)",
        "descricao": "Acesso total ao sistema, incluindo despesas e admin.",
        "is_master": True,
    },
    "medico": {
        "label": "Médico",
        "descricao": "Acesso a pacientes, consultas, prontuários e exames.",
        "is_master": False,
    },
    "atendente": {
        "label": "Atendente",
        "descricao": "Acesso a pacientes, agendamentos e consultas básicas.",
        "is_master": False,
    },
    "enfermeiro": {
        "label": "Enfermeiro",
        "descricao": "Acesso a pacientes, consultas (leitura), exames e procedimentos.",
        "is_master": False,
    },
    "financeiro": {
        "label": "Financeiro",
        "descricao": "Acesso ao módulo financeiro, pagamentos e relatórios.",
        "is_master": False,
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────


def _user_to_dict(user: Autenticadores) -> dict:
    """Serializa Autenticadores para resposta da API."""
    return {
        "id": user.id,
        "usuario": user.usuario,
        "tipo": user.tipo,
        "tipo_label": TIPOS_USUARIO.get(user.tipo, {}).get("label", user.tipo),
        "is_master": user.is_master,
        "permissions": user.get_all_permissions(),
    }


# ── GET /admin/users ─────────────────────────────────────────────────────


@staff_admin_bp.route("/users", methods=["GET"])
def list_users():
    """Lista todos os usuários com filtro opcional por tipo."""
    try:
        query = Autenticadores.query

        if tipo := request.args.get("tipo"):
            query = query.filter(Autenticadores.tipo == tipo.strip().lower())

        if search := request.args.get("search"):
            query = query.filter(Autenticadores.usuario.ilike(f"%{search.strip()}%"))

        query = query.order_by(Autenticadores.tipo.asc(), Autenticadores.usuario.asc())
        users = query.all()

        return jsonify(
            {
                "total": len(users),
                "users": [_user_to_dict(u) for u in users],
            }
        )

    except Exception as exc:
        current_app.logger.error("[StaffAdmin] Erro ao listar: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao listar usuários"}), 500


# ── GET /admin/users/tipos ───────────────────────────────────────────────


@staff_admin_bp.route("/users/tipos", methods=["GET"])
def list_tipos():
    """Retorna tipos de usuário disponíveis com descrições."""
    return jsonify(
        {
            "tipos": [
                {
                    "value": key,
                    "label": info["label"],
                    "descricao": info["descricao"],
                    "is_master": info["is_master"],
                }
                for key, info in TIPOS_USUARIO.items()
            ],
        }
    )


# ── GET /admin/users/stats ──────────────────────────────────────────────


@staff_admin_bp.route("/users/stats", methods=["GET"])
def users_stats():
    """Estatísticas de distribuição de usuários por tipo."""
    try:
        by_tipo = (
            db.session.query(
                Autenticadores.tipo,
                func.count(Autenticadores.id),
            )
            .group_by(Autenticadores.tipo)
            .order_by(func.count(Autenticadores.id).desc())
            .all()
        )

        total = sum(c for _, c in by_tipo)

        return jsonify(
            {
                "total": total,
                "por_tipo": [
                    {
                        "tipo": tipo,
                        "label": TIPOS_USUARIO.get(tipo, {}).get("label", tipo),
                        "count": count,
                        "pct": round((count / total) * 100, 1) if total else 0,
                    }
                    for tipo, count in by_tipo
                ],
            }
        )

    except Exception as exc:
        current_app.logger.error("[StaffAdmin] Erro stats: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao gerar estatísticas"}), 500


# ── GET /admin/users/<id> ────────────────────────────────────────────────


@staff_admin_bp.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id: int):
    """Retorna detalhe de um usuário."""
    user = Autenticadores.query.get(user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    return jsonify(_user_to_dict(user))


# ── PUT /admin/users/<id> ────────────────────────────────────────────────


@staff_admin_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id: int):
    """
    Atualiza dados de um usuário.

    Body:
        - tipo: novo tipo do usuário (admin, medico, etc.)
        - usuario: novo identificador (opcional)
    """
    try:
        user = Autenticadores.query.get(user_id)
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404

        data = request.json or {}

        # Atualizar tipo
        if "tipo" in data:
            novo_tipo = str(data["tipo"]).strip().lower()
            if novo_tipo not in TIPOS_USUARIO:
                return (
                    jsonify(
                        {
                            "error": f"Tipo inválido. Use: {', '.join(TIPOS_USUARIO.keys())}",
                        }
                    ),
                    400,
                )
            user.tipo = novo_tipo

        # Atualizar identificador
        if "usuario" in data:
            novo_usuario = normalize_string(data["usuario"])
            if not novo_usuario:
                return jsonify({"error": "Identificador não pode ser vazio"}), 400

            existing = Autenticadores.query.filter(
                db.func.lower(Autenticadores.usuario) == novo_usuario.lower(),
                Autenticadores.id != user_id,
            ).first()
            if existing:
                return jsonify({"error": "Este identificador já está em uso"}), 409

            user.usuario = novo_usuario

        db.session.commit()

        return jsonify(
            {
                "message": "Usuário atualizado",
                "user": _user_to_dict(user),
            }
        )

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erro de integridade no banco"}), 409
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("[StaffAdmin] Erro update: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao atualizar usuário"}), 500


# ── POST /admin/users ────────────────────────────────────────────────────


@staff_admin_bp.route("/users", methods=["POST"])
def create_user():
    """
    Cria novo usuário.

    Body:
        - usuario: identificador (obrigatório)
        - senha: senha (obrigatório)
        - tipo: tipo do usuário (obrigatório)
    """
    try:
        data = request.json or {}

        usuario = normalize_string(data.get("usuario"))
        senha = data.get("senha", "")
        tipo = str(data.get("tipo", "")).strip().lower()

        if not usuario or not senha or not tipo:
            return jsonify({"error": "usuario, senha e tipo são obrigatórios"}), 400

        if tipo not in TIPOS_USUARIO:
            return (
                jsonify(
                    {
                        "error": f"Tipo inválido. Use: {', '.join(TIPOS_USUARIO.keys())}",
                    }
                ),
                400,
            )

        if len(senha) < 6:
            return jsonify({"error": "Senha deve ter pelo menos 6 caracteres"}), 400

        existing = Autenticadores.query.filter(
            db.func.lower(Autenticadores.usuario) == usuario.lower()
        ).first()
        if existing:
            return jsonify({"error": "Este identificador já está em uso"}), 409

        novo = Autenticadores(
            usuario=usuario,
            senha=hash_password(senha),
            tipo=tipo,
        )
        db.session.add(novo)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Usuário criado",
                    "user": _user_to_dict(novo),
                }
            ),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erro de integridade no banco"}), 409
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("[StaffAdmin] Erro create: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao criar usuário"}), 500


# ── DELETE /admin/users/<id> ─────────────────────────────────────────────


@staff_admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id: int):
    """Exclui um usuário. Não permite auto-exclusão."""
    try:
        from flask_jwt_extended import current_user

        user = Autenticadores.query.get(user_id)
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404

        # Proteção contra auto-exclusão
        if current_user and current_user.id == user_id:
            return jsonify({"error": "Não é possível excluir a si mesmo"}), 409

        db.session.delete(user)
        db.session.commit()

        return jsonify({"message": "Usuário excluído"})

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("[StaffAdmin] Erro delete: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao excluir usuário"}), 500
