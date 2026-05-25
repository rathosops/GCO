"""
Configurações centralizadas do sistema CMI Chamadas.

Utiliza Pydantic Settings para validação e carregamento de variáveis
de ambiente, mantendo a aplicação configurável e tipada.
"""

from functools import lru_cache
from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações da aplicação carregadas do ambiente."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ==========================================================
    # Aplicação
    # ==========================================================
    app_name: str = "CMI Sistema de Chamadas"
    api_version: str = "v1"
    environment: str = "development"  # development | staging | production
    debug: bool = True
    log_level: str = "INFO"

    # ==========================================================
    # Banco de dados
    # ==========================================================
    # Por padrão, Pydantic procura a env var DATABASE_URL (case-insensitive)
    database_url: str = "postgresql://cmi:cmi123@db:5432/cmi_db"

    # Parâmetros de pool (podem ser ajustados via env, ex: DB_POOL_SIZE=20)
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle: int = 1800  # segundos (30 min)
    db_pool_timeout: int = 30  # segundos

    # ==========================================================
    # Redis
    # ==========================================================
    redis_url: str = "redis://redis:6379/3"

    # ==========================================================
    # CORS
    # ==========================================================
    cors_origins: str = "http://localhost:3001,http://localhost:3000"

    # ==========================================================
    # JWT
    # ==========================================================
    secret_key: str = "super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 horas

    # ==========================================================
    # WebSocket
    # ==========================================================
    ws_heartbeat_interval: int = 30
    ws_max_connections: int = 100

    # ==========================================================
    # Chamadas
    # ==========================================================
    max_chamadas_painel: ClassVar[int] = 5
    tempo_exibicao_chamada: ClassVar[int] = 60  # segundos

    # ==========================================================
    # Logging (pensado para uso com app.utils.logger.setup_logger)
    # ==========================================================
    log_format: str = "pretty"  # "pretty" | "json"
    log_file: str | None = None
    log_rotation: str = "1 week"
    log_retention: str = "30 days"

    # ==========================================================
    # Helpers
    # ==========================================================
    @property
    def cors_origins_list(self) -> list[str]:
        """Retorna lista de origens CORS permitidas."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin]

    @property
    def is_development(self) -> bool:
        """Verifica se está em ambiente de desenvolvimento."""
        return self.environment.lower() == "development"

    @property
    def is_production(self) -> bool:
        """Verifica se está em ambiente de produção."""
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Retorna instância única das configurações (singleton)."""
    return Settings()
