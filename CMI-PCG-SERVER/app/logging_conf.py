"""
Configuração única de logging (Flask + Celery) com:

- DEV (TTY): logs coloridos via RichHandler
- Docker/non-TTY: logs em uma linha (plain) ou JSON
- PROD: logs estruturados em JSON (stdout/stderr)
- Correlation IDs: request_id e task_id via contextvars

Por padrão:
- Se LOG_FORMAT=console, mas não há TTY => cai para "plain" automaticamente
  (evita indentação/wrapping estranho no docker logs).
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from contextvars import ContextVar
from logging.config import dictConfig
from typing import Any

from pythonjsonlogger.json import JsonFormatter  # noqa: F401  # usado via dictConfig
from rich.logging import RichHandler  # noqa: F401  # usado via dictConfig

REQUEST_ID: ContextVar[str] = ContextVar("request_id", default="-")
TASK_ID: ContextVar[str] = ContextVar("task_id", default="-")


class ContextFilter(logging.Filter):
    """Injeta request_id/task_id em todo LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = REQUEST_ID.get()
        record.task_id = TASK_ID.get()
        return True


def set_request_id(value: str | None = None) -> str:
    rid = value or str(uuid.uuid4())
    REQUEST_ID.set(rid)
    return rid


def clear_request_id() -> None:
    REQUEST_ID.set("-")


def set_task_id(value: str | None) -> None:
    TASK_ID.set(value or "-")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _has_tty() -> bool:
    # docker logs geralmente não é tty (mesmo que stream seja "stdout")
    try:
        return sys.stdout.isatty()
    except Exception:
        return False


def configure_logging(*, service_name: str) -> None:
    """
    Env vars suportadas:
      - LOG_LEVEL (default INFO)
      - LOG_FORMAT: console | plain | json
      - LOG_JSON: true/false (atalho)

      - LOG_WERKZEUG_LEVEL (default INFO)
      - LOG_SQLALCHEMY_LEVEL (default WARNING)
      - LOG_CELERY_LEVEL (default LOG_LEVEL)
    """
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "").strip().lower()
    log_json = _env_bool("LOG_JSON", default=False)

    # Heurística: se LOG_FORMAT não foi definido, console em dev, json em prod
    if not log_format:
        env = os.getenv("FLASK_ENV", "production").lower()
        log_format = "console" if env == "development" else "json"

    if log_json:
        log_format = "json"

    # Se o usuário pediu console mas não há TTY, não use Rich (evita indentação no docker logs)
    if log_format == "console" and not _has_tty():
        # Pode trocar por "json" se preferir sempre estruturado no Docker
        log_format = "plain"

    handlers: dict[str, Any] = {}
    formatters: dict[str, Any] = {}

    if log_format == "console":
        handlers["console"] = {
            "class": "rich.logging.RichHandler",
            "level": level_name,
            "rich_tracebacks": True,
            "tracebacks_show_locals": False,
            "markup": False,
            # evita quebra agressiva, mas no TTY costuma ficar ok
            "log_time_format": "[%x %X]",
        }
        formatters["console"] = {
            "format": "%(name)s | %(levelname)s | req=%(request_id)s task=%(task_id)s | %(message)s"
        }
        handlers["console"]["formatter"] = "console"

    elif log_format == "plain":
        # Formato de 1 linha, perfeito para Docker logs (sem wrapping/colunas)
        formatters["plain"] = {
            "format": "%(asctime)s %(levelname)s %(name)s req=%(request_id)s task=%(task_id)s - %(message)s"
        }
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": level_name,
            "stream": "ext://sys.stdout",
            "formatter": "plain",
        }

    else:
        formatters["json"] = {
            "()": "pythonjsonlogger.json.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s %(task_id)s",
            "rename_fields": {"levelname": "level", "asctime": "timestamp"},
            "static_fields": {
                "service": service_name,
                "env": os.getenv("FLASK_ENV", "production"),
            },
        }
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": level_name,
            "stream": "ext://sys.stdout",
            "formatter": "json",
        }

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"context": {"()": ContextFilter}},
            "formatters": formatters,
            "handlers": {
                "console": {**handlers["console"], "filters": ["context"]},
            },
            "root": {"level": level_name, "handlers": ["console"]},
            "loggers": {
                "werkzeug": {"level": os.getenv("LOG_WERKZEUG_LEVEL", "INFO")},
                "sqlalchemy.engine": {
                    "level": os.getenv("LOG_SQLALCHEMY_LEVEL", "WARNING")
                },
                "celery": {"level": os.getenv("LOG_CELERY_LEVEL", level_name)},
            },
        }
    )
