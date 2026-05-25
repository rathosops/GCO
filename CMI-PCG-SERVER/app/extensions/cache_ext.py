"""
Extensão de cache usando Redis.

- Mantém configuração isolada (DRY).
- Evita imports cruzados no app.
"""

from __future__ import annotations

import os

from flask import Flask
from flask_caching import Cache

cache = Cache()


def init_cache(app: Flask) -> None:
    """Inicializa Flask-Caching com Redis."""
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

    app.config.update(
        CACHE_TYPE="RedisCache",
        CACHE_REDIS_URL=redis_url,
        CACHE_DEFAULT_TIMEOUT=int(os.getenv("CACHE_DEFAULT_TIMEOUT", "60")),
    )
    cache.init_app(app)
