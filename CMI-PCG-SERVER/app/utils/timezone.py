"""
Utilitários de timezone para o sistema CMI.

Regra: TODO o sistema usa America/Sao_Paulo.
Nunca usar datetime.utcnow() (deprecated no Python 3.12+).
"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import sqlalchemy as sa

SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")


def get_now_sao_paulo() -> datetime:
    """Retorna datetime atual no fuso de São Paulo (timezone-aware)."""
    return datetime.now(tz=SAO_PAULO_TZ)


def get_today_sao_paulo() -> date:
    """Retorna data atual no fuso de São Paulo."""
    return get_now_sao_paulo().date()


def get_time_sao_paulo() -> time:
    """Retorna hora atual no fuso de São Paulo (sem microsegundos)."""
    return get_now_sao_paulo().time().replace(microsecond=0)


# ── Helpers para SQLAlchemy ──────────────────────────────────────────────


def sa_now() -> sa.text:
    """
    server_default para colunas de timestamp no PostgreSQL.

    Uso no model:
        created_at = db.Column(
            db.DateTime(timezone=True),
            server_default=sa_now(),
            nullable=False,
        )
    """
    return sa.text("(now() AT TIME ZONE 'America/Sao_Paulo')")


def sa_utc_now() -> sa.text:
    """server_default UTC (para compatibilidade com sistemas que esperam UTC)."""
    return sa.text("now()")
