"""
Endpoints de configuração de música de fundo.

Permite:
- Painel consultar a configuração atual (endpoint público).
- Admin definir a fonte de música de fundo (trilha interna ou YouTube).
- Admin gerenciar playlist de faixas (CRUD + reorder + aplicar por ID).
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentAdmin, DbSession
from app.schemas.music import (
    BackgroundMusicConfigResponse,
    BackgroundMusicConfigUpdate,
    BackgroundMusicPlaylistReorder,
    BackgroundMusicTrackCreate,
    BackgroundMusicTrackResponse,
    BackgroundMusicTrackUpdate,
)
from app.services.music_service import MusicService

router = APIRouter(prefix="/music", tags=["Música"])


# ===================== Configuração atual =====================


@router.get("/background", response_model=BackgroundMusicConfigResponse)
async def get_background_music(db: DbSession) -> BackgroundMusicConfigResponse:
    """
    Retorna configuração atual de música de fundo.

    Endpoint público, utilizado pelo painel principal.
    """
    service = MusicService(db)
    config = service.get_config()
    return BackgroundMusicConfigResponse.model_validate(config)


@router.put("/background", response_model=BackgroundMusicConfigResponse)
async def update_background_music(
    payload: BackgroundMusicConfigUpdate,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - usado apenas para garantir permissão
) -> BackgroundMusicConfigResponse:
    """
    Atualiza configuração de música de fundo.

    Somente administradores podem alterar.
    """
    service = MusicService(db)

    try:
        config = service.update_config(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return BackgroundMusicConfigResponse.model_validate(config)


# ===================== Playlist / Tracks (ADMIN) =====================


@router.get(
    "/playlist",
    response_model=list[BackgroundMusicTrackResponse],
)
async def list_playlist(
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> list[BackgroundMusicTrackResponse]:
    """
    Lista a playlist de faixas ativas, ordenadas.

    Restrito a administradores (por enquanto).
    """
    service = MusicService(db)
    tracks = service.get_playlist()
    return [BackgroundMusicTrackResponse.model_validate(t) for t in tracks]


@router.post(
    "/playlist",
    response_model=BackgroundMusicTrackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_track(
    payload: BackgroundMusicTrackCreate,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> BackgroundMusicTrackResponse:
    """
    Cria uma nova faixa na playlist.

    Restrito a administradores.
    """
    service = MusicService(db)

    try:
        track = service.create_track(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return BackgroundMusicTrackResponse.model_validate(track)


@router.put(
    "/playlist/{track_id}",
    response_model=BackgroundMusicTrackResponse,
)
async def update_track(
    track_id: int,
    payload: BackgroundMusicTrackUpdate,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> BackgroundMusicTrackResponse:
    """
    Atualiza parcialmente uma faixa da playlist.

    Restrito a administradores.
    """
    service = MusicService(db)

    try:
        track = service.update_track(track_id, payload)
    except ValueError as exc:
        # Para simplificar, tratamos todos como 400 (dados inválidos ou id inexistente)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return BackgroundMusicTrackResponse.model_validate(track)


@router.delete(
    "/playlist/{track_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_track(
    track_id: int,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> None:
    """
    Remove uma faixa da playlist.

    Restrito a administradores.
    """
    service = MusicService(db)

    try:
        service.delete_track(track_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/playlist/reorder",
    response_model=list[BackgroundMusicTrackResponse],
)
async def reorder_playlist(
    payload: BackgroundMusicPlaylistReorder,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> list[BackgroundMusicTrackResponse]:
    """
    Reordena a playlist com base na lista de IDs enviada.

    Restrito a administradores.
    """
    service = MusicService(db)

    try:
        tracks = service.reorder_playlist(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return [BackgroundMusicTrackResponse.model_validate(t) for t in tracks]


@router.post(
    "/playlist/{track_id}/apply",
    response_model=BackgroundMusicConfigResponse,
)
async def apply_track_as_current(
    track_id: int,
    db: DbSession,
    user: CurrentAdmin,  # noqa: ARG001 - apenas autorização
) -> BackgroundMusicConfigResponse:
    """
    Aplica uma faixa da playlist como configuração atual do painel.

    É um atalho para não precisar enviar todos os campos da faixa;
    o backend resolve tipo, URL, video_id e título.
    """
    service = MusicService(db)

    try:
        config = service.apply_track_as_current(track_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return BackgroundMusicConfigResponse.model_validate(config)
