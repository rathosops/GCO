"""
Application factory do Flask.

Objetivos:
- Evitar import circular
- Centralizar criação/config/registro de extensões/blueprints
- Permitir create_app(register_blueprints=False) para worker Celery
- Suporte robusto a migrações via Flask-Migrate

Princípios aplicados:
- DRY: Configurações centralizadas
- KISS: Funções pequenas e focadas
- SRP: Cada função tem uma responsabilidade
- Zen do Python: "Explicit is better than implicit"
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from dotenv import load_dotenv
from pathlib import Path
from flask import Flask, g, jsonify, request
from flask_migrate import Migrate
from werkzeug.exceptions import HTTPException


from app.database import db
from app.extensions.cache_ext import init_cache
from app.extensions.jwt_ext import init_jwt
from app.extensions.redis_ext import init_redis
from app.src.audit import init_audit_listeners
from app.logging_conf import clear_request_id, configure_logging, set_request_id
from app.webhooks.discord_webhook import DiscordLogHandler

if TYPE_CHECKING:
    from flask.typing import ResponseReturnValue

# Instância global do Migrate para acesso em outros módulos
migrate = Migrate()


def _configure_database(app: Flask) -> None:
    """
    Configura a URI do SQLAlchemy via variáveis de ambiente.

    A URI é construída a partir das seguintes env vars:
    - POSTGRES_USER
    - POSTGRES_PASSWORD
    - POSTGRES_HOST
    - POSTGRES_PORT
    - POSTGRES_DB
    """
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
        f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Configurações de pool para produção
    if os.getenv("FLASK_ENV") == "production":
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_pre_ping": True,  # Verifica conexão antes de usar
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "pool_recycle": 300,  # Recicla conexões a cada 5 min
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
        }


def _configure_app_logger(app: Flask) -> None:
    """
    Configura handler do Discord para logs críticos.

    O logger global/formatters/handlers já foram configurados via dictConfig
    em logging_conf.py. Aqui apenas adicionamos o handler do Discord.
    """
    discord_handler = DiscordLogHandler()
    discord_handler.setLevel(os.getenv("DISCORD_LOG_LEVEL", "WARNING"))
    app.logger.addHandler(discord_handler)


def _register_error_handlers(app: Flask) -> None:
    """
    Registra handlers de erro que retornam JSON.

    Isso garante que todas as exceções sejam retornadas em formato
    consistente para o frontend.
    """

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException) -> ResponseReturnValue:
        """Handler para exceções HTTP conhecidas (4xx, 5xx)."""
        app.logger.warning("HTTPException", exc_info=exc)
        return jsonify({"error": exc.description}), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(exc: Exception) -> ResponseReturnValue:
        """Handler para exceções não tratadas."""
        app.logger.error("Unhandled Exception", exc_info=exc)
        return jsonify({"error": "Erro interno do servidor"}), 500


def _register_request_context_hooks(app: Flask) -> None:
    """
    Configura hooks de request para rastreamento.

    Injeta request_id em:
    - Contexto do logging (para cada log no request)
    - Header de resposta X-Request-ID (útil pro frontend e debug)
    """

    @app.before_request
    def _before_request() -> None:
        rid = request.headers.get("X-Request-ID")
        g.request_id = set_request_id(rid)

    @app.after_request
    def _after_request(response):
        rid = getattr(g, "request_id", None)
        if rid:
            response.headers["X-Request-ID"] = rid
        clear_request_id()
        return response


def _register_cli_commands(app: Flask) -> None:
    """Registra comandos CLI customizados.

    Em modo rollback legado, alguns comandos do auth novo podem não existir.
    Não pode quebrar a inicialização do app.
    """
    try:
        from app.scripts.seed_auth import register_cli
        register_cli(app)
    except Exception as exc:  # pragma: no cover
        app.logger.warning("CLI commands not loaded: %s", exc)



def _import_models() -> None:
    """
    Importa todos os modelos para garantir que estejam registrados
    no metadata do SQLAlchemy antes das migrações.

    IMPORTANTE: Esta função deve ser chamada ANTES de Migrate(app, db)
    para que o Alembic consiga detectar todas as tabelas.
    """
    # pylint: disable=import-outside-toplevel,unused-import
    # Importar módulo models carrega todos os modelos
    from app import models  # noqa: F401


def create_app(*, register_blueprints: bool = True) -> Flask:
    """
    Cria e configura a aplicação Flask.

    Esta é a função factory principal. Ela:
    1. Carrega variáveis de ambiente
    2. Configura logging
    3. Cria a instância Flask
    4. Configura banco de dados e extensões
    5. Registra blueprints (opcional)

    Args:
        register_blueprints: Quando False, não importa/registra controllers.
            Útil para workers Celery que só precisam de app_context + db.engine.

    Returns:
        Instância Flask configurada.

    Example:
        >>> app = create_app()  # Aplicação completa
        >>> app = create_app(register_blueprints=False)  # Para Celery/migrations
    """
    load_dotenv()

    # Configure logging o mais cedo possível (antes de app.logger ser acessado)
    configure_logging(service_name="cmi-pcg-server")

    BASE_DIR = Path(__file__).resolve().parent.parent
    TEMPLATES_DIR = BASE_DIR / "templates"
    STATIC_DIR = BASE_DIR / "static"

    app = Flask(
        __name__,
        template_folder=str(TEMPLATES_DIR),
        static_folder=str(STATIC_DIR),
    )

    # Limite de upload (CSV) - boa prática de segurança
    app.config["MAX_CONTENT_LENGTH"] = (
        int(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024
    )

    # Configurações core
    _configure_database(app)
    _configure_app_logger(app)
    _register_error_handlers(app)
    _register_request_context_hooks(app)

    # Inicializa SQLAlchemy
    db.init_app(app)

    # IMPORTANTE: Importar modelos ANTES de inicializar Migrate
    # Isso garante que todas as tabelas estejam no metadata
    _import_models()

    # Inicializa Flask-Migrate com configurações otimizadas
    # - compare_type=True: Detecta mudanças de tipo de coluna
    # - render_as_batch=True: Compatibilidade com SQLite (e melhor para alguns ALTERs)
    migrate.init_app(
        app,
        db,
        compare_type=True,
        render_as_batch=True,
    )

    # Outras extensões
    init_cache(app)
    init_jwt(app)
    init_redis(app)
    init_audit_listeners(app)

    # CLI commands
    _register_cli_commands(app)

    if register_blueprints:
        # Import lazy evita circular
        from app.blueprints import blueprints

        for bp in blueprints:
            app.register_blueprint(bp)

    return app
