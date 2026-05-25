"""
Extensão JWT - Flask-JWT-Extended (LEGACY-ONLY).

Modo rollback:
- Suporta APENAS Autenticadores (legado)
- current_user sempre será Autenticadores
- Claims sempre indicam is_legacy=True

Obs:
- Mantém blocklist via Redis (logout revoga access token)
"""

from __future__ import annotations

import os
from datetime import timedelta
from typing import TYPE_CHECKING

from flask import Flask, jsonify
from flask_jwt_extended import JWTManager

if TYPE_CHECKING:
    from app.models.auth_model import Autenticadores

    AuthUser = Autenticadores

jwt = JWTManager()


def init_jwt(app: Flask) -> None:
    """Inicializa Flask-JWT-Extended com configurações seguras (legacy-only)."""
    app.config["JWT_SECRET_KEY"] = os.getenv(
        "JWT_SECRET_KEY",
        "CHANGE-THIS-IN-PRODUCTION-" + os.urandom(32).hex(),
    )
    app.config["JWT_ALGORITHM"] = "HS256"

    access_expires = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "900"))
    refresh_expires = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", "604800"))

    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(seconds=access_expires)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(seconds=refresh_expires)

    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    jwt.init_app(app)
    _register_jwt_callbacks(app)


def _register_jwt_callbacks(app: Flask) -> None:
    """Registra callbacks do JWT (legacy-only)."""

    @jwt.user_identity_loader
    def user_identity_lookup(user: "AuthUser") -> str:
        """Extrai identidade do usuário (somente legado)."""
        if isinstance(user, dict):
            return str(user.get("id", user))
        if hasattr(user, "id"):
            return str(user.id)
        return str(user)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header: dict, jwt_data: dict) -> "AuthUser | None":
        """Carrega usuário a partir do JWT (somente legado)."""
        from app.models.auth_model import Autenticadores

        identity = jwt_data.get("sub")
        try:
            user_id = int(identity)
        except (ValueError, TypeError):
            return None

        return Autenticadores.query.get(user_id)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header: dict, jwt_payload: dict) -> bool:
        """Verifica se o token está na blocklist."""
        from app.extensions.redis_ext import redis_client
        from app.src.auth.constants import REDIS_BLOCKLIST_PREFIX

        jti = jwt_payload.get("jti")
        if not jti:
            return True

        token_in_redis = redis_client.get(f"{REDIS_BLOCKLIST_PREFIX}{jti}")
        return token_in_redis is not None

    @jwt.additional_claims_loader
    def add_claims_to_access_token(identity) -> dict:
        """Adiciona claims extras ao access token (somente legado)."""
        from app.models.auth_model import Autenticadores

        # identity pode vir como int, str, dict ou objeto (tokens antigos)
        if isinstance(identity, dict):
            identity = identity.get("id")

        if hasattr(identity, "id"):
            identity = getattr(identity, "id", None)

        try:
            user_id = int(identity)
        except (ValueError, TypeError):
            app.logger.warning(f"Failed to parse identity as int: {identity}")
            return {}

        legacy = Autenticadores.query.get(user_id)
        if not legacy:
            app.logger.warning(f"Legacy user not found for identity: {identity}")
            return {}

        return {
            "nome": legacy.usuario,
            "email": legacy.usuario,
            "staff_type": legacy.tipo,
            "role": legacy.tipo,
            "is_master": legacy.is_master,
            "is_legacy": True,
        }

    # --- Error handlers ---

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header: dict, jwt_payload: dict) -> tuple:
        return (
            jsonify(
                {
                    "error": "token_expired",
                    "message": "Token expirado. Faça login novamente.",
                }
            ),
            401,
        )

    @jwt.invalid_token_loader
    def invalid_token_callback(error: str) -> tuple:
        return (
            jsonify(
                {
                    "error": "invalid_token",
                    "message": "Token inválido.",
                }
            ),
            401,
        )

    @jwt.unauthorized_loader
    def missing_token_callback(error: str) -> tuple:
        return (
            jsonify(
                {
                    "error": "authorization_required",
                    "message": "Token de autorização não fornecido.",
                }
            ),
            401,
        )

    @jwt.needs_fresh_token_loader
    def token_not_fresh_callback(jwt_header: dict, jwt_payload: dict) -> tuple:
        return (
            jsonify(
                {
                    "error": "fresh_token_required",
                    "message": "Esta operação requer autenticação recente.",
                }
            ),
            401,
        )

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header: dict, jwt_payload: dict) -> tuple:
        return (
            jsonify(
                {
                    "error": "token_revoked",
                    "message": "Token foi revogado. Faça login novamente.",
                }
            ),
            401,
        )

    @jwt.user_lookup_error_loader
    def user_lookup_error_callback(jwt_header: dict, jwt_payload: dict) -> tuple:
        return (
            jsonify(
                {
                    "error": "user_not_found",
                    "message": "Usuário não encontrado.",
                }
            ),
            401,
        )
