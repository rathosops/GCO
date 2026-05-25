"""
Schemas Pydantic para configuração de música de fundo do painel
e playlist de músicas.
"""

from enum import Enum

from pydantic import BaseModel


class BackgroundMusicType(str, Enum):
    """Tipo de fonte da música de fundo (lado Pydantic)."""

    SYSTEM = "SYSTEM"
    YOUTUBE = "YOUTUBE"


class BackgroundMusicConfigBase(BaseModel):
    """Campos em comum entre leitura e atualização da configuração atual."""

    type: BackgroundMusicType
    system_track_path: str | None = None
    youtube_url: str | None = None
    youtube_video_id: str | None = None
    display_title: str | None = None


class BackgroundMusicConfigResponse(BackgroundMusicConfigBase):
    """Resposta enviada para o frontend com a configuração atual."""

    id: int

    class Config:
        """Configuração Pydantic."""

        from_attributes = True  # permite model_validate a partir do ORM


class BackgroundMusicConfigUpdate(BaseModel):
    """
    Payload para atualização da configuração de música de fundo.

    Regras:
    - Se type == SYSTEM:
        - system_track_path é obrigatório.
    - Se type == YOUTUBE:
        - youtube_url é obrigatório.
        - display_title é opcional (backend define default se não vier).
    """

    type: BackgroundMusicType
    system_track_path: str | None = None
    youtube_url: str | None = None
    display_title: str | None = None


# ===================== Playlist / Tracks =====================


class BackgroundMusicTrackBase(BaseModel):
    """Campos comuns de uma faixa da playlist."""

    type: BackgroundMusicType
    system_track_path: str | None = None
    youtube_url: str | None = None
    youtube_video_id: str | None = None
    display_title: str | None = None
    order_index: int = 0
    is_active: bool = True


class BackgroundMusicTrackCreate(BaseModel):
    """
    Payload para criação de uma faixa na playlist.

    Regras:
    - Se type == SYSTEM:
        - system_track_path é obrigatório.
    - Se type == YOUTUBE:
        - youtube_url é obrigatória.
        - display_title é opcional.
    - order_index é opcional; se não informado, vai para o final da fila.
    """

    type: BackgroundMusicType
    system_track_path: str | None = None
    youtube_url: str | None = None
    display_title: str | None = None
    order_index: int | None = None
    is_active: bool = True


class BackgroundMusicTrackUpdate(BaseModel):
    """
    Payload para atualização parcial de uma faixa da playlist.

    Todos os campos são opcionais; somente os presentes serão alterados.
    """

    type: BackgroundMusicType | None = None
    system_track_path: str | None = None
    youtube_url: str | None = None
    display_title: str | None = None
    order_index: int | None = None
    is_active: bool | None = None


class BackgroundMusicTrackResponse(BackgroundMusicTrackBase):
    """Representação de uma faixa da playlist."""

    id: int

    class Config:
        """Configuração Pydantic."""

        from_attributes = True


class BackgroundMusicPlaylistReorder(BaseModel):
    """
    Payload para reordenar a playlist.

    track_ids define a ordem desejada (0 = primeiro).
    """

    track_ids: list[int]
