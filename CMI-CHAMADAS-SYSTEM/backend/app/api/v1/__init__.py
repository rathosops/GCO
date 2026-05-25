"""API v1 do sistema de chamadas."""

from fastapi import APIRouter

from app.api.v1 import (
    agendamentos,
    auth,
    chamadas,
    dev,
    music,
    triagem,
    usuarios,
    websocket,
)

# Prefixo raiz da API REST
api_router = APIRouter(prefix="/api/v1")

# Incluir routers (cada router já define seu próprio prefix/tag)
api_router.include_router(auth.router)  # /auth
api_router.include_router(chamadas.router)  # /chamadas
api_router.include_router(triagem.router)  # /triagem
api_router.include_router(agendamentos.router)  # /agendamentos
api_router.include_router(dev.router)  # /dev
api_router.include_router(usuarios.router)  # /usuarios
api_router.include_router(music.router)  # /music

# WebSocket router (sem prefixo /api/v1)
ws_router = websocket.router
