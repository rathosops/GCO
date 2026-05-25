"""
Serviço de autenticação (LEGACY-ONLY).

Rollback:
- Login apenas em Autenticadores (legado)
- Refresh token stateless (sem tabela RefreshToken)
- Logout revoga apenas access token (blocklist Redis)
- Sessions/logout-all/revoke-session retornam 501 (não suportado em legacy-only)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Tuple

from flask_jwt_extended import create_access_token, create_refresh_token

from app.database import db
from app.extensions.redis_ext import (
    add_token_to_blocklist,
    get_login_attempts,
    increment_login_attempts,
    reset_login_attempts,
)
from app.models.auth_model import Autenticadores
from app.src.auth.constants import (
    ACCESS_TOKEN_EXPIRES,
    LOGIN_LOCKOUT_MINUTES,
    MAX_LOGIN_ATTEMPTS,
)
from app.src.auth.utils import (
    hash_password,
    sanitize_email,
    verify_password,
)

if TYPE_CHECKING:
    from flask import Request

AuthUser = Autenticadores


class AuthService:
    """Serviço de autenticação (legacy-only)."""

    # -----------------------------------------
    # Internals
    # -----------------------------------------

    @staticmethod
    def _find_user(identifier: str) -> AuthUser | None:
        """Busca usuário legado por 'usuario'."""
        identifier = identifier.strip().lower()
        return Autenticadores.query.filter(
            db.func.lower(Autenticadores.usuario) == identifier
        ).first()

    @staticmethod
    def _verify_legacy_password(user: Autenticadores, password: str) -> bool:
        """Verifica senha do sistema legado."""
        stored = user.senha or ""

        # Se já foi migrado para Argon2, verifica pelo hasher
        if stored.startswith("$argon2"):
            return verify_password(password, stored)

        # Fallback: comparação direta (plaintext legado)
        return stored == password

    # -----------------------------------------
    # Public API
    # -----------------------------------------

    @staticmethod
    def login(
        email: str,
        password: str,
        request: "Request | None" = None,
    ) -> Tuple[dict | None, str | None, int]:
        """
        Realiza login do usuário (somente Autenticadores).

        Args:
            email: usuário/email (legado usa "usuario")
            password: senha em texto
            request: (não usado no rollback, mantido por compatibilidade)

        Returns:
            (data, error, status)
        """
        identifier = sanitize_email(email)

        # Rate limiting (Redis)
        attempts = get_login_attempts(identifier)
        if attempts >= MAX_LOGIN_ATTEMPTS:
            return None, "Muitas tentativas. Tente novamente mais tarde.", 429

        user = AuthService._find_user(identifier)

        if not user:
            increment_login_attempts(identifier, LOGIN_LOCKOUT_MINUTES)
            return None, "Email ou senha inválidos", 401

        # Legado sempre ativo (vide model), mas mantemos a checagem por compatibilidade
        if not user.is_active:
            return None, "Conta desativada", 403

        if not AuthService._verify_legacy_password(user, password):
            increment_login_attempts(identifier, LOGIN_LOCKOUT_MINUTES)
            return None, "Email ou senha inválidos", 401

        reset_login_attempts(identifier)

        # Tokens (stateless)
        # IMPORTANTE: identity precisa ser serializável e compatível com o loader do JWT.
        # No legado, usamos o ID (int) do Autenticadores.
        access_token = create_access_token(
            identity=int(user.id),
            fresh=True,
            additional_claims={"is_legacy": True},
        )
        refresh_token = create_refresh_token(
            identity=int(user.id),
            additional_claims={"is_legacy": True},
        )

        return (
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": ACCESS_TOKEN_EXPIRES,
                "user": user.to_dict(include_permissions=True),
            },
            None,
            200,
        )

    @staticmethod
    def refresh_access_token(
        user: Autenticadores,
    ) -> Tuple[dict | None, str | None, int]:
        """Gera novo access token a partir do usuário do refresh token (stateless)."""
        if not user:
            return None, "Usuário não encontrado", 401

        access_token = create_access_token(identity=int(user.id), fresh=False)

        return (
            {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": ACCESS_TOKEN_EXPIRES,
            },
            None,
            200,
        )

    @staticmethod
    def logout(access_jti: str, staff_id: int) -> Tuple[dict | None, str | None, int]:
        """Logout revogando somente o access token (blocklist Redis)."""
        add_token_to_blocklist(access_jti, ACCESS_TOKEN_EXPIRES)
        return {"message": "Logout realizado com sucesso"}, None, 200

    # -----------------------------------------
    # Recursos do auth novo (DESLIGADOS)
    # -----------------------------------------

    @staticmethod
    def logout_all_sessions(
        staff_id: int, current_user_id: int
    ) -> Tuple[dict | None, str | None, int]:
        return None, "Recurso não disponível no modo legado", 501

    @staticmethod
    def revoke_session(
        session_id: int, staff_id: int
    ) -> Tuple[dict | None, str | None, int]:
        return None, "Recurso não disponível no modo legado", 501

    @staticmethod
    def get_active_sessions(
        staff_id: int, current_jti: str | None = None
    ) -> list[dict]:
        return []

    # -----------------------------------------
    # Troca de senha (LEGADO) - opcional mas útil
    # -----------------------------------------

    @staticmethod
    def change_password(
        user: Autenticadores,
        current_password: str,
        new_password: str,
    ) -> Tuple[dict | None, str | None, int]:
        """
        Troca senha no legado.

        - Verifica senha atual (suporta plaintext e argon2)
        - Salva SEMPRE em Argon2 (migrando automaticamente para hash seguro)
        """
        if not user:
            return None, "Usuário não encontrado", 401

        if not current_password or not new_password:
            return None, "Senha atual e nova senha são obrigatórias", 400

        if not AuthService._verify_legacy_password(user, current_password):
            return None, "Senha atual incorreta", 400

        # Migra/define hash seguro
        user.senha = hash_password(new_password)
        db.session.commit()

        return {"message": "Senha alterada com sucesso"}, None, 200
