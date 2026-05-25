"""
Extensão Redis - Conexão e helpers.

Usos:
- JWT blocklist (revogação de tokens)
- Sessões ativas
- Rate limiting de login
- Cache de permissões
"""

from __future__ import annotations

import os
from typing import Any

import redis
from flask import Flask


class RedisClient:
    """
    Wrapper para conexão Redis.

    Singleton-like: mesma conexão reutilizada.
    """

    _client: redis.Redis | None = None

    def __init__(self):
        self._ensure_connection()

    def _ensure_connection(self) -> None:
        """Garante que a conexão existe."""
        if RedisClient._client is None:
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
            blocklist_db = int(os.getenv("REDIS_BLOCKLIST_DB", "3"))

            # Parse URL e ajusta DB para blocklist
            RedisClient._client = redis.from_url(
                redis_url,
                db=blocklist_db,
                decode_responses=True,
            )

    @property
    def client(self) -> redis.Redis:
        """Retorna cliente Redis."""
        self._ensure_connection()
        return RedisClient._client

    def get(self, key: str) -> str | None:
        """GET com tratamento de erro."""
        try:
            return self.client.get(key)
        except redis.RedisError:
            return None

    def set(
        self,
        key: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
    ) -> bool:
        """SET com TTL opcional."""
        try:
            return self.client.set(key, value, ex=ex, px=px)
        except redis.RedisError:
            return False

    def delete(self, *keys: str) -> int:
        """DELETE uma ou mais chaves."""
        try:
            return self.client.delete(*keys)
        except redis.RedisError:
            return 0

    def exists(self, key: str) -> bool:
        """Verifica se chave existe."""
        try:
            return bool(self.client.exists(key))
        except redis.RedisError:
            return False

    def incr(self, key: str) -> int:
        """Incrementa valor."""
        try:
            return self.client.incr(key)
        except redis.RedisError:
            return 0

    def expire(self, key: str, seconds: int) -> bool:
        """Define TTL em uma chave."""
        try:
            return self.client.expire(key, seconds)
        except redis.RedisError:
            return False

    def ttl(self, key: str) -> int:
        """Retorna TTL de uma chave."""
        try:
            return self.client.ttl(key)
        except redis.RedisError:
            return -1

    def scan_iter(self, match: str) -> list[str]:
        """Itera sobre chaves que correspondem ao padrão."""
        try:
            return list(self.client.scan_iter(match=match))
        except redis.RedisError:
            return []

    def ping(self) -> bool:
        """Verifica se Redis está disponível."""
        try:
            return self.client.ping()
        except redis.RedisError:
            return False


# Instância global
redis_client = RedisClient()


def init_redis(app: Flask) -> None:
    """
    Inicializa conexão Redis e adiciona health check.

    Chamado no app_factory.
    """
    # Testa conexão
    if not redis_client.ping():
        app.logger.warning("Redis não está disponível. Algumas features podem falhar.")

    # Registra no app context se necessário
    app.extensions["redis"] = redis_client


# ============================================
# Helpers específicos para Auth
# ============================================


def add_token_to_blocklist(jti: str, expires_in: int) -> bool:
    """
    Adiciona token à blocklist.

    Args:
        jti: JWT ID único
        expires_in: Tempo em segundos até o token expirar

    O TTL garante que tokens expirados sejam removidos automaticamente.
    """
    from app.src.auth.constants import REDIS_BLOCKLIST_PREFIX

    key = f"{REDIS_BLOCKLIST_PREFIX}{jti}"
    return redis_client.set(key, "revoked", ex=expires_in)


def is_token_blocklisted(jti: str) -> bool:
    """Verifica se token está na blocklist."""
    from app.src.auth.constants import REDIS_BLOCKLIST_PREFIX

    key = f"{REDIS_BLOCKLIST_PREFIX}{jti}"
    return redis_client.exists(key)


def get_login_attempts(identifier: str) -> int:
    """Retorna número de tentativas de login falhas."""
    from app.src.auth.constants import REDIS_LOGIN_ATTEMPTS_PREFIX

    key = f"{REDIS_LOGIN_ATTEMPTS_PREFIX}{identifier}"
    value = redis_client.get(key)
    return int(value) if value else 0


def increment_login_attempts(identifier: str, lockout_minutes: int = 15) -> int:
    """
    Incrementa contador de tentativas de login.

    Args:
        identifier: Email ou IP
        lockout_minutes: Tempo de bloqueio

    Returns:
        Número atual de tentativas
    """
    from app.src.auth.constants import REDIS_LOGIN_ATTEMPTS_PREFIX

    key = f"{REDIS_LOGIN_ATTEMPTS_PREFIX}{identifier}"
    attempts = redis_client.incr(key)

    # Define/renova TTL
    redis_client.expire(key, lockout_minutes * 60)

    return attempts


def reset_login_attempts(identifier: str) -> bool:
    """Reseta contador de tentativas após login bem-sucedido."""
    from app.src.auth.constants import REDIS_LOGIN_ATTEMPTS_PREFIX

    key = f"{REDIS_LOGIN_ATTEMPTS_PREFIX}{identifier}"
    return redis_client.delete(key) > 0


def cache_user_permissions(
    staff_id: int, permissions: list[str], ttl: int = 300
) -> bool:
    """
    Cache de permissões do usuário (5 min default).

    Evita recalcular permissões a cada request.
    """
    import json

    key = f"auth:permissions:{staff_id}"
    return redis_client.set(key, json.dumps(permissions), ex=ttl)


def get_cached_permissions(staff_id: int) -> list[str] | None:
    """Retorna permissões do cache."""
    import json

    key = f"auth:permissions:{staff_id}"
    value = redis_client.get(key)

    if value:
        return json.loads(value)
    return None


def invalidate_permissions_cache(staff_id: int) -> bool:
    """Invalida cache de permissões de um usuário."""
    key = f"auth:permissions:{staff_id}"
    return redis_client.delete(key) > 0
