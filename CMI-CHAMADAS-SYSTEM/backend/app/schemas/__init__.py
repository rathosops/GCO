"""Schemas Pydantic do sistema de chamadas."""

# ==== Auth / Login ====
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UsuarioResponse as AuthUsuarioResponse,
    UsuarioCreate as AuthUsuarioCreate,
    UsuarioUpdate as AuthUsuarioUpdate,
)

# ==== Chamadas ====
from app.schemas.chamada import (
    ChamadaCreate,
    ChamadaPainelResponse,
    ChamadaResponse,
    ChamadaUpdate,
    FinalizarAtendimentoRequest,
    IniciarAtendimentoRequest,
)

# ==== Músicas ====
from app.schemas.music import (
    BackgroundMusicConfigResponse,
    BackgroundMusicConfigUpdate,
    BackgroundMusicPlaylistReorder,
    BackgroundMusicTrackCreate,
    BackgroundMusicTrackResponse,
    BackgroundMusicTrackUpdate,
    BackgroundMusicType,
)

# ==== Salas ====
from app.schemas.sala import SalaCreate, SalaResponse, SalaUpdate

# ==== Triagem ====
from app.schemas.triagem import ConcluirTriagemRequest, TriagemCreate, TriagemResponse

# ==== Usuários (CRUD administrativo) ====
from app.schemas.usuario import UsuarioBase, UsuarioCreate, UsuarioRead, UsuarioUpdate


__all__ = [
    # Auth
    "LoginRequest",
    "TokenResponse",
    "AuthUsuarioResponse",
    "AuthUsuarioCreate",
    "AuthUsuarioUpdate",
    # Chamadas
    "ChamadaCreate",
    "ChamadaPainelResponse",
    "ChamadaResponse",
    "ChamadaUpdate",
    "FinalizarAtendimentoRequest",
    "IniciarAtendimentoRequest",
    # Salas
    "SalaCreate",
    "SalaResponse",
    "SalaUpdate",
    # Triagem
    "ConcluirTriagemRequest",
    "TriagemCreate",
    "TriagemResponse",
    # Usuários (Admin CRUD)
    "UsuarioBase",
    "UsuarioCreate",
    "UsuarioRead",
    "UsuarioUpdate",
    # Músicas
    "BackgroundMusicConfigResponse",
    "BackgroundMusicConfigUpdate",
    "BackgroundMusicPlaylistReorder",
    "BackgroundMusicTrackCreate",
    "BackgroundMusicTrackResponse",
    "BackgroundMusicTrackUpdate",
    "BackgroundMusicType",
]
