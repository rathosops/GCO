"""
Controller de Autenticação - Endpoints de Auth (ROLLBACK LEGADO).

Mantém endpoints para compatibilidade, mas:
- /auth/login funciona (legado)
- /auth/refresh funciona (stateless)
- /auth/logout funciona (blocklist access token)
- /auth/logout-all retorna 501
- /auth/sessions retorna lista vazia (compatível)
- /auth/sessions/<id> retorna 501
- /auth/me GET funciona
- /auth/me PUT só permite trocar "usuario" (alias: email/usuario)
- /auth/change-password funciona (migra senha para argon2)
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, get_jwt, jwt_required

from app.database import db
from app.models.auth_model import Autenticadores
from app.src.auth import AuthService, sanitize_email

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ============================================
# Login / Logout
# ============================================


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}

    identificador = (
        data.get("email") or data.get("usuario") or data.get("identificador") or ""
    )
    identificador = identificador.strip() if identificador else ""
    senha = data.get("senha", "")

    if not identificador or not senha:
        return jsonify({"error": "Usuário/email e senha são obrigatórios"}), 400

    result, error, status = AuthService.login(
        email=identificador,
        password=senha,
        request=request,
    )

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    result, error, status = AuthService.refresh_access_token(current_user)

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


@auth_bp.route("/logout", methods=["DELETE"])
@jwt_required()
def logout():
    jwt_data = get_jwt()
    access_jti = jwt_data.get("jti")

    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    if not access_jti:
        return jsonify({"error": "Token inválido"}), 401

    result, error, status = AuthService.logout(
        access_jti=access_jti,
        staff_id=current_user.id,
    )

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


@auth_bp.route("/logout-all", methods=["DELETE"])
@jwt_required()
def logout_all():
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    result, error, status = AuthService.logout_all_sessions(
        staff_id=current_user.id,
        current_user_id=current_user.id,
    )

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


# ============================================
# Usuário Atual
# ============================================


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    include_perms = request.args.get("include_permissions", "true").lower() == "true"
    return jsonify(current_user.to_dict(include_permissions=include_perms))


@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_current_user():
    """
    No legado, os campos disponíveis são limitados.
    Permitimos apenas troca do identificador (usuario),
    aceitando chaves: email/usuario/identificador.
    """
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    data = request.json or {}

    new_identifier = (
        data.get("email") or data.get("usuario") or data.get("identificador")
    )
    if not new_identifier:
        return jsonify({"error": "Nada para atualizar"}), 400

    new_identifier = sanitize_email(new_identifier)

    # Se não mudou, ok
    if new_identifier == current_user.usuario:
        return jsonify(
            {"message": "Nenhuma alteração necessária", "user": current_user.to_dict()}
        )

    # Checa duplicidade na própria tabela legado
    existing = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == new_identifier.lower()
    ).first()

    if existing and existing.id != current_user.id:
        return jsonify({"error": "Este usuário já está em uso"}), 409

    current_user.usuario = new_identifier
    db.session.commit()

    return jsonify(
        {
            "message": "Dados atualizados com sucesso",
            "user": current_user.to_dict(),
        }
    )


@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required(fresh=True)
def change_password():
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    data = request.json or {}
    senha_atual = data.get("senha_atual", "")
    nova_senha = data.get("nova_senha", "")

    if not senha_atual or not nova_senha:
        return jsonify({"error": "Senha atual e nova senha são obrigatórias"}), 400

    result, error, status = AuthService.change_password(
        user=current_user,
        current_password=senha_atual,
        new_password=nova_senha,
    )

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


# ============================================
# Sessões (compatibilidade)
# ============================================


@auth_bp.route("/sessions", methods=["GET"])
@jwt_required()
def list_sessions():
    """
    Modo legado não mantém sessões em DB.
    Mantemos endpoint para compatibilidade retornando vazio.
    """
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    sessions = AuthService.get_active_sessions(
        staff_id=current_user.id, current_jti=None
    )

    return jsonify({"total": len(sessions), "sessions": sessions})


@auth_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@jwt_required()
def revoke_session(session_id: int):
    if not current_user:
        return jsonify({"error": "Usuário não encontrado"}), 401

    result, error, status = AuthService.revoke_session(
        session_id=session_id,
        staff_id=current_user.id,
    )

    if error:
        return jsonify({"error": error}), status

    return jsonify(result), status


# ============================================
# Health Check
# ============================================


@auth_bp.route("/health", methods=["GET"])
def health_check():
    """Verifica se o serviço de auth está funcionando (Redis)."""
    from app.extensions.redis_ext import redis_client

    redis_ok = redis_client.ping()

    return (
        jsonify(
            {
                "status": "healthy" if redis_ok else "degraded",
                "redis": "ok" if redis_ok else "error",
            }
        ),
        (200 if redis_ok else 503),
    )
