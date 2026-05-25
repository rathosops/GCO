"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the FastAPI application."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "GCO"
    app_version: str = "2.0.0"
    app_env: str = "development"
    app_timezone: str = "America/Sao_Paulo"
    api_prefix: str = "/api"

    database_url: str = "postgresql+psycopg://gco:gco@postgres:5432/gco"
    db_pool_size: int = 3
    db_max_overflow: int = 2
    db_pool_timeout: int = 20
    db_pool_recycle: int = 900
    redis_url: str = "redis://redis:6379/0"

    secret_key: SecretStr = Field(default=SecretStr("change-me"))
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost,http://127.0.0.1"
    ws_heartbeat_seconds: int = 30
    log_level: str = "INFO"

    panel_max_visible_calls: int = 5
    panel_call_display_seconds: int = 60

    @property
    def is_development(self) -> bool:
        """Return whether the application is running in development mode."""

        return self.app_env.lower() == "development"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return configured CORS origins as a normalized list."""

        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    def validate_production_security(self) -> None:
        """Fail fast when production is started with unsafe defaults."""

        if self.is_development:
            return

        secret = self.secret_key.get_secret_value()
        if secret == "change-me" or len(secret) < 32:
            msg = "SECRET_KEY deve ser definido com ao menos 32 caracteres em producao"
            raise RuntimeError(msg)


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    settings = Settings()
    settings.validate_production_security()
    return settings
