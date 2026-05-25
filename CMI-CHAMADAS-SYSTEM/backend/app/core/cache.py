"""
Cache Redis otimizado para o sistema de chamadas.

Estratégia:
- Agendamentos do dia: TTL 30s (dados mudam pouco)
- Chamadas ativas: invalidação por evento
- Config música: TTL 5min
"""

import json
from datetime import date
from functools import wraps
from typing import Any, Callable

import redis
from loguru import logger

from app.core.config import get_settings

settings = get_settings()

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    """Retorna cliente Redis singleton."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
    return _redis_client


class CacheKeys:
    """Chaves de cache padronizadas."""

    AGENDAMENTOS_HOJE = "chamadas:agendamentos:hoje:{dia}"
    AGENDAMENTOS_AGUARDANDO = "chamadas:agendamentos:aguardando:{dia}"
    AGENDAMENTOS_CONFIRMADOS = "chamadas:agendamentos:confirmados:{dia}"
    CHAMADAS_PAINEL = "chamadas:painel:ativas"
    CHAMADAS_HISTORICO = "chamadas:historico:hoje:{dia}"
    MUSIC_CONFIG = "chamadas:music:config"
    TRIAGEM_PENDENTES = "chamadas:triagem:pendentes:{dia}"


class CacheTTL:
    """TTLs em segundos."""

    AGENDAMENTOS = 30
    CHAMADAS_PAINEL = 10
    CHAMADAS_HISTORICO = 30
    MUSIC_CONFIG = 300
    TRIAGEM = 20


def cache_get(key: str) -> Any | None:
    """Busca valor do cache."""
    try:
        r = get_redis()
        data = r.get(key)
        if data:
            return json.loads(data)
    except (redis.RedisError, json.JSONDecodeError) as e:
        logger.debug("CACHE_GET_MISS | key={} | error={}", key, e)
    return None


def cache_set(key: str, value: Any, ttl: int = 60) -> bool:
    """Salva valor no cache."""
    try:
        r = get_redis()
        r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except (redis.RedisError, TypeError) as e:
        logger.warning("CACHE_SET_FAIL | key={} | error={}", key, e)
    return False


def cache_delete(key: str) -> bool:
    """Remove chave do cache."""
    try:
        r = get_redis()
        r.delete(key)
        return True
    except redis.RedisError as e:
        logger.warning("CACHE_DELETE_FAIL | key={} | error={}", key, e)
    return False


def cache_delete_pattern(pattern: str) -> int:
    """Remove chaves por pattern."""
    try:
        r = get_redis()
        keys = r.keys(pattern)
        if keys:
            return r.delete(*keys)
    except redis.RedisError as e:
        logger.warning("CACHE_DELETE_PATTERN_FAIL | pattern={} | error={}", pattern, e)
    return 0


def invalidate_chamadas() -> None:
    """Invalida cache de chamadas (chamar após criar/atualizar/finalizar)."""
    hoje = date.today().isoformat()
    cache_delete(CacheKeys.CHAMADAS_PAINEL)
    cache_delete(CacheKeys.CHAMADAS_HISTORICO.format(dia=hoje))
    cache_delete(CacheKeys.AGENDAMENTOS_AGUARDANDO.format(dia=hoje))
    cache_delete(CacheKeys.AGENDAMENTOS_CONFIRMADOS.format(dia=hoje))


def invalidate_triagem() -> None:
    """Invalida cache de triagem."""
    hoje = date.today().isoformat()
    cache_delete(CacheKeys.TRIAGEM_PENDENTES.format(dia=hoje))
    invalidate_chamadas()


def invalidate_agendamentos() -> None:
    """Invalida todo cache de agendamentos."""
    cache_delete_pattern("chamadas:agendamentos:*")


def cached(
    key_template: str,
    ttl: int = 60,
    key_params: list[str] | None = None,
) -> Callable:
    """
    Decorator para cache automático.

    Args:
        key_template: Template da chave (ex: "user:{user_id}")
        ttl: Tempo de vida em segundos
        key_params: Lista de parâmetros da função para montar a chave
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Monta chave
            if key_params:
                params = {p: kwargs.get(p, args[key_params.index(p)] if len(args) > key_params.index(p) else "") for p in key_params}
                cache_key = key_template.format(**params)
            else:
                cache_key = key_template

            # Tenta cache
            cached_value = cache_get(cache_key)
            if cached_value is not None:
                logger.debug("CACHE_HIT | key={}", cache_key)
                return cached_value

            # Executa função
            result = func(*args, **kwargs)

            # Salva no cache
            if result is not None:
                cache_set(cache_key, result, ttl)

            return result

        return wrapper

    return decorator
