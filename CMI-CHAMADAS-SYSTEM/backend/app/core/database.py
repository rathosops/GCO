"""
Configuração de banco de dados otimizada.

Pool de conexões ajustado para:
- Menos conexões ociosas
- Reciclagem mais agressiva
- Pre-ping para validação
"""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import get_settings

Base = declarative_base()
settings = get_settings()


def _get_url() -> str:
    """Resolve URL do banco."""
    url = getattr(settings, "database_url", None)
    if not url:
        raise RuntimeError("DATABASE_URL não configurada")
    return url


# Engine otimizado
engine = create_engine(
    _get_url(),
    poolclass=QueuePool,
    pool_pre_ping=True,  # Valida conexão antes de usar
    pool_size=5,  # Menos conexões - sistema pequeno
    max_overflow=10,  # Burst moderado
    pool_recycle=900,  # Recicla a cada 15min
    pool_timeout=20,  # Timeout menor
    echo=False,  # Desliga SQL logging em prod
    future=True,
    # Otimizações de conexão PostgreSQL
    connect_args={
        "options": "-c statement_timeout=30000",  # 30s max por query
    },
)


# Listener para configurar conexão
@event.listens_for(engine, "connect")
def _set_connection_options(dbapi_conn, connection_record):
    """Configura opções de performance na conexão."""
    cursor = dbapi_conn.cursor()
    # Timezone
    cursor.execute("SET TIME ZONE 'America/Sao_Paulo'")
    # Work memory para queries complexas
    cursor.execute("SET work_mem = '16MB'")
    cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """Dependency FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager para uso fora de endpoints."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
