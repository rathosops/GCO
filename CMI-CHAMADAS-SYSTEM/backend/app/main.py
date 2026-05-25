"""
CMI Sistema de Chamadas - Aplicação Principal.

Sistema de chamadas de pacientes para clínica médica.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

from app.api.v1 import api_router, ws_router
from app.core.config import get_settings
from app.core.database import engine, Base
from app.models import *  # noqa: F401, F403 - Importa todos os models para criar tabelas
from app.websocket.manager import manager

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Gerencia ciclo de vida da aplicação."""
    logger.info("Iniciando CMI Sistema de Chamadas...")

    # Criar apenas as tabelas novas do sistema de chamadas
    # (não tenta criar agendamentos/procedimentos que já existem)
    logger.info("Verificando/criando tabelas do sistema de chamadas...")

    from app.models.usuario import UsuarioChamadas
    from app.models.chamada import Chamada
    from app.models.sala import Sala
    from app.models.triagem import TriagemIMESC
    from app.models.music import BackgroundMusicConfig, BackgroundMusicTrack

    # Criar apenas as tabelas que pertencem ao sistema de chamadas
    # ORDEM IMPORTANTE: usuarios e salas primeiro (sem FK externa),
    # depois chamadas e triagem (que dependem de agendamentos existente)
    tables_to_create = [
        UsuarioChamadas.__table__,
        Sala.__table__,
        TriagemIMESC.__table__,
        Chamada.__table__,
        BackgroundMusicConfig.__table__,
        BackgroundMusicTrack.__table__,
    ]

    # Usar checkfirst=True para não falhar se tabela já existe
    for table in tables_to_create:
        table.create(bind=engine, checkfirst=True)

    # Criar usuário admin padrão se não existir
    await _create_default_users()

    logger.info("Sistema de chamadas pronto!")
    yield
    logger.info("Encerrando CMI Sistema de Chamadas...")


async def _create_default_users() -> None:
    """Cria usuários padrão se não existirem."""
    from app.core.database import SessionLocal
    from app.core.security import get_password_hash
    from app.models.usuario import TipoUsuario, UsuarioChamadas
    from app.models.sala import Sala, TipoSala

    db = SessionLocal()
    try:
        # Verificar se já existem usuários
        existing = db.execute(text("SELECT COUNT(*) FROM usuarios_chamadas")).scalar()
        if existing > 0:
            logger.info(f"Sistema já possui {existing} usuário(s) cadastrado(s)")
            return

        # Criar usuários padrão
        usuarios_padrao = [
            {
                "username": "admin",
                "nome": "Administrador",
                "senha_hash": get_password_hash("admin123"),
                "tipo": TipoUsuario.ADMIN,
                "sala": None,
            },
            {
                "username": "medico",
                "nome": "Dr. Exemplo",
                "senha_hash": get_password_hash("medico123"),
                "tipo": TipoUsuario.MEDICO,
                "sala": "Consultório 1",
            },
            {
                "username": "triagem",
                "nome": "Assistente Social",
                "senha_hash": get_password_hash("triagem123"),
                "tipo": TipoUsuario.TRIAGEM,
                "sala": "Triagem",
            },
            {
                "username": "dev",
                "nome": "Desenvolvedor",
                "senha_hash": get_password_hash("dev123"),
                "tipo": TipoUsuario.DEV,
                "sala": None,
            },
        ]

        for u in usuarios_padrao:
            usuario = UsuarioChamadas(**u)
            db.add(usuario)

        # Criar salas padrão
        salas_padrao = [
            {"codigo": "CONS1", "nome": "Consultório 1", "tipo": TipoSala.CONSULTORIO},
            {"codigo": "TRIAG", "nome": "Triagem", "tipo": TipoSala.TRIAGEM},
        ]

        for s in salas_padrao:
            sala = Sala(**s)
            db.add(sala)

        db.commit()
        logger.info("Usuários e salas padrão criados com sucesso!")
        logger.info("Credenciais padrão:")
        logger.info("  - admin/admin123 (Administrador)")
        logger.info("  - medico/medico123 (Médico)")
        logger.info("  - triagem/triagem123 (Triagem)")
        logger.info("  - dev/dev123 (Desenvolvedor)")

    except Exception as e:
        logger.error(f"Erro ao criar usuários padrão: {e}")
        db.rollback()
    finally:
        db.close()


# Criar aplicação
app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    description="Sistema de chamadas de pacientes para clínica médica",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(api_router)
app.include_router(ws_router)


# Health check
@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Verifica saúde da aplicação."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.api_version,
    }


# Handler de erros global
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler global de exceções."""
    logger.exception(f"Erro não tratado: {exc}")

    # Notificar devs via WebSocket (sem quebrar se der erro aqui)
    try:
        await manager.broadcast_error(
            code="EXCEPTION",
            message=str(exc),
            context={
                "path": str(request.url),
                "method": request.method,
            },
        )
    except Exception as e:  # pragma: no cover - proteção extra
        logger.warning(f"Falha ao notificar erro via WebSocket: {e}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno do servidor"},
    )
