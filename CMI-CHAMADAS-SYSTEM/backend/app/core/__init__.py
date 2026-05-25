"""Módulo core com configurações, banco de dados, segurança e cache."""

from app.core.cache import (
    cache_delete,
    cache_get,
    cache_set,
    get_redis,
    invalidate_agendamentos,
    invalidate_chamadas,
    invalidate_triagem,
)
from app.core.config import Settings, get_settings
from app.core.database import Base, SessionLocal, engine, get_db, get_db_context
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)

__all__ = [
    "Base",
    "SessionLocal",
    "Settings",
    "cache_delete",
    "cache_get",
    "cache_set",
    "create_access_token",
    "decode_access_token",
    "engine",
    "get_db",
    "get_db_context",
    "get_password_hash",
    "get_redis",
    "get_settings",
    "invalidate_agendamentos",
    "invalidate_chamadas",
    "invalidate_triagem",
    "verify_password",
]
