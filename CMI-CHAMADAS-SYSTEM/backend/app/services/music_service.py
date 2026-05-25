"""
Serviço de configuração de música de fundo do painel.

Responsável por:
- Buscar/criar configuração única (estado atual).
- Atualizar fonte de música (trilha interna ou YouTube).
- Validar URL do YouTube e extrair video_id.
- Gerenciar playlist de faixas (CRUD + reorder).
"""

from collections.abc import Mapping
from typing import Any

from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.music import (
    BackgroundMusicConfig,
    BackgroundMusicTrack,
    BackgroundMusicType,
)
from app.schemas.music import (
    BackgroundMusicConfigUpdate,
    BackgroundMusicPlaylistReorder,
    BackgroundMusicTrackCreate,
    BackgroundMusicTrackUpdate,
)


class MusicService:
    """Serviço para gerenciar música de fundo do painel e playlist."""

    # Trilha padrão quando não houver nenhuma configuração
    DEFAULT_SYSTEM_TRACK: str = "/sounds/loop_sound_1.mp3"
    DEFAULT_SYSTEM_TITLE: str = "Trilha padrão do sistema"
    DEFAULT_YT_TITLE: str = "Música do YouTube"

    def __init__(self, db: Session) -> None:
        self.db = db

    # ===================== Configuração atual =====================

    def get_or_create_config(self) -> BackgroundMusicConfig:
        """
        Retorna a configuração atual, criando uma padrão se não existir.

        Returns:
            Instância de BackgroundMusicConfig.
        """
        config = (
            self.db.query(BackgroundMusicConfig)
            .order_by(BackgroundMusicConfig.id.asc())
            .first()
        )

        if config:
            return config

        logger.info(
            "BACKGROUND_MUSIC_CONFIG_CREATE_DEFAULT | track={} | title={}",
            self.DEFAULT_SYSTEM_TRACK,
            self.DEFAULT_SYSTEM_TITLE,
        )

        config = BackgroundMusicConfig(
            type=BackgroundMusicType.SYSTEM,
            system_track_path=self.DEFAULT_SYSTEM_TRACK,
            display_title=self.DEFAULT_SYSTEM_TITLE,
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def get_config(self) -> BackgroundMusicConfig:
        """
        Retorna a configuração atual (cria padrão se não existir).

        Returns:
            Configuração de música de fundo.
        """
        return self.get_or_create_config()

    def update_config(self, data: BackgroundMusicConfigUpdate) -> BackgroundMusicConfig:
        """
        Atualiza a configuração de música de fundo.

        Args:
            data: Dados de atualização.

        Returns:
            Configuração atualizada.

        Raises:
            ValueError: Em caso de dados inconsistentes (ex: URL inválida).
        """
        config = self.get_or_create_config()
        payload = data.model_dump()

        logger.debug(
            "BACKGROUND_MUSIC_CONFIG_UPDATE_REQUEST | payload_keys={}",
            list(payload.keys()),
        )

        if data.type == data.type.SYSTEM:
            self._apply_system_source(config, payload)
        elif data.type == data.type.YOUTUBE:
            self._apply_youtube_source(config, payload)
        else:
            msg = f"Tipo de música de fundo não suportado: {data.type}"
            raise ValueError(msg)

        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)

        logger.info(
            (
                "BACKGROUND_MUSIC_CONFIG_UPDATED | type={} | "
                "system_track_path={} | youtube_video_id={}"
            ),
            config.type.value,
            config.system_track_path,
            config.youtube_video_id,
        )

        return config

    # ===================== Playlist / Tracks =====================

    def get_playlist(self) -> list[BackgroundMusicTrack]:
        """
        Retorna a playlist de faixas ativas, ordenada.

        Returns:
            Lista de BackgroundMusicTrack.
        """
        tracks = (
            self.db.query(BackgroundMusicTrack)
            .filter(BackgroundMusicTrack.is_active.is_(True))
            .order_by(
                BackgroundMusicTrack.order_index.asc(),
                BackgroundMusicTrack.id.asc(),
            )
            .all()
        )
        return tracks

    def create_track(self, data: BackgroundMusicTrackCreate) -> BackgroundMusicTrack:
        """
        Cria uma nova faixa na playlist.

        Args:
            data: Dados da faixa.

        Returns:
            Faixa criada.

        Raises:
            ValueError: Se os dados não forem consistentes.
        """
        payload = data.model_dump()

        try:
            track_type = BackgroundMusicType(payload["type"])
        except ValueError as exc:
            msg = f"Tipo de música de fundo não suportado: {payload['type']}"
            raise ValueError(msg) from exc

        track = BackgroundMusicTrack(
            type=track_type,
            is_active=bool(payload.get("is_active", True)),
        )

        if track_type == BackgroundMusicType.SYSTEM:
            self._apply_system_source(track, payload)
        elif track_type == BackgroundMusicType.YOUTUBE:
            self._apply_youtube_source(track, payload)
        else:  # pragma: no cover - proteção extra
            msg = f"Tipo de música de fundo não suportado: {track_type}"
            raise ValueError(msg)

        # Definir ordem: se não informado, vai para o final
        if data.order_index is not None:
            track.order_index = data.order_index
        else:
            max_order = self.db.query(
                func.max(BackgroundMusicTrack.order_index),
            ).scalar()
            track.order_index = int(max_order or 0) + 1

        self.db.add(track)
        self.db.commit()
        self.db.refresh(track)

        logger.info(
            (
                "BACKGROUND_MUSIC_TRACK_CREATED | id={} | type={} | "
                "system_track_path={} | youtube_video_id={} | order_index={}"
            ),
            track.id,
            track.type.value,
            track.system_track_path,
            track.youtube_video_id,
            track.order_index,
        )

        return track

    def update_track(
        self,
        track_id: int,
        data: BackgroundMusicTrackUpdate,
    ) -> BackgroundMusicTrack:
        """
        Atualiza parcialmente uma faixa da playlist.

        Args:
            track_id: ID da faixa.
            data: Dados a atualizar.

        Returns:
            Faixa atualizada.

        Raises:
            ValueError: Se faixa não for encontrada ou dados inválidos.
        """
        track = self._get_track(track_id)
        payload = data.model_dump(exclude_unset=True)

        # Atualizar tipo, se informado
        if "type" in payload and payload["type"] is not None:
            try:
                track.type = BackgroundMusicType(payload["type"])
            except ValueError as exc:
                msg = f"Tipo de música de fundo não suportado: {payload['type']}"
                raise ValueError(msg) from exc

        # Atualizar flags simples
        if "is_active" in payload and payload["is_active"] is not None:
            track.is_active = bool(payload["is_active"])

        if "order_index" in payload and payload["order_index"] is not None:
            track.order_index = int(payload["order_index"])

        # Atualizar campos específicos por tipo
        if track.type == BackgroundMusicType.SYSTEM:
            self._apply_system_source(track, payload)
        elif track.type == BackgroundMusicType.YOUTUBE:
            self._apply_youtube_source(track, payload)

        self.db.add(track)
        self.db.commit()
        self.db.refresh(track)

        logger.info(
            (
                "BACKGROUND_MUSIC_TRACK_UPDATED | id={} | type={} | "
                "system_track_path={} | youtube_video_id={} | order_index={} "
                "| is_active={}"
            ),
            track.id,
            track.type.value,
            track.system_track_path,
            track.youtube_video_id,
            track.order_index,
            track.is_active,
        )

        return track

    def delete_track(self, track_id: int) -> None:
        """
        Remove uma faixa da playlist.

        Args:
            track_id: ID da faixa.

        Raises:
            ValueError: Se a faixa não for encontrada.
        """
        track = self._get_track(track_id)
        self.db.delete(track)
        self.db.commit()

        logger.info("BACKGROUND_MUSIC_TRACK_DELETED | id={}", track_id)

    def reorder_playlist(
        self,
        data: BackgroundMusicPlaylistReorder,
    ) -> list[BackgroundMusicTrack]:
        """
        Reordena a playlist com base em uma lista de IDs.

        Args:
            data: Objeto contendo track_ids na ordem desejada.

        Returns:
            Lista atualizada de faixas ordenadas.

        Raises:
            ValueError: Se algum ID não existir.
        """
        track_ids = data.track_ids
        if not track_ids:
            # Nada a fazer, apenas retorna playlist atual
            return self.get_playlist()

        existing_tracks = (
            self.db.query(BackgroundMusicTrack)
            .filter(BackgroundMusicTrack.id.in_(track_ids))
            .all()
        )
        tracks_by_id = {track.id: track for track in existing_tracks}
        missing = [track_id for track_id in track_ids if track_id not in tracks_by_id]

        if missing:
            msg = f"Algumas faixas não foram encontradas: {missing}"
            raise ValueError(msg)

        for order_index, track_id in enumerate(track_ids):
            tracks_by_id[track_id].order_index = order_index

        self.db.commit()

        logger.info(
            "BACKGROUND_MUSIC_PLAYLIST_REORDERED | track_ids={}",
            track_ids,
        )

        return self.get_playlist()

    def apply_track_as_current(self, track_id: int) -> BackgroundMusicConfig:
        """
        Aplica uma faixa da playlist como configuração atual do painel.

        Útil para acionar a troca de música por ID, sem o Admin precisar
        reenviar todos os campos manualmente.

        Args:
            track_id: ID da faixa a aplicar.

        Returns:
            Configuração atualizada.

        Raises:
            ValueError: Se a faixa não existir ou for inconsistente.
        """
        track = self._get_track(track_id)

        update_data = BackgroundMusicConfigUpdate(
            type=(
                BackgroundMusicConfigUpdate.__fields__["type"].annotation.SYSTEM  # type: ignore[attr-defined]
                if track.type == BackgroundMusicType.SYSTEM
                else BackgroundMusicConfigUpdate.__fields__["type"].annotation.YOUTUBE  # type: ignore[attr-defined]
            ),
            system_track_path=track.system_track_path,
            youtube_url=track.youtube_url,
            display_title=track.display_title,
        )

        # A atualização de config já faz todas as validações necessárias
        return self.update_config(update_data)

    # ===================== Helpers internos =====================

    def _apply_system_source(
        self,
        target: BackgroundMusicConfig | BackgroundMusicTrack,
        payload: Mapping[str, Any],
    ) -> None:
        """
        Aplica configuração para trilha interna do sistema.

        Regras:
        - system_track_path é obrigatório.
        - Campos de YouTube são limpos.
        """
        track = payload.get("system_track_path") or self.DEFAULT_SYSTEM_TRACK
        if not isinstance(track, str) or not track.strip():
            msg = "Para tipo SYSTEM, 'system_track_path' é obrigatório."
            raise ValueError(msg)

        title = payload.get("display_title") or self.DEFAULT_SYSTEM_TITLE

        target.type = BackgroundMusicType.SYSTEM
        target.system_track_path = track.strip()
        target.youtube_url = None
        target.youtube_video_id = None
        target.display_title = str(title).strip()

    def _apply_youtube_source(
        self,
        target: BackgroundMusicConfig | BackgroundMusicTrack,
        payload: Mapping[str, Any],
    ) -> None:
        """
        Aplica configuração para fonte YouTube.

        Regras:
        - youtube_url é obrigatória.
        - video_id é extraído e validado.
        - Campos de trilha interna são limpos.
        """
        url_raw = payload.get("youtube_url")
        if not isinstance(url_raw, str) or not url_raw.strip():
            msg = "Para tipo YOUTUBE, 'youtube_url' é obrigatória."
            raise ValueError(msg)

        url, video_id, title = self._prepare_youtube_fields(
            url_raw,
            payload.get("display_title"),
        )

        target.type = BackgroundMusicType.YOUTUBE
        target.youtube_url = url
        target.youtube_video_id = video_id
        target.system_track_path = None
        target.display_title = title

    def _prepare_youtube_fields(
        self,
        url_raw: str,
        display_title: str | None,
    ) -> tuple[str, str, str]:
        """
        Normaliza URL do YouTube, extrai video_id e título.

        Returns:
            (url_normalizada, video_id, titulo)
        """
        url = url_raw.strip()
        video_id = self._extract_youtube_video_id(url)
        if not video_id:
            msg = "URL do YouTube inválida ou não foi possível extrair o ID do vídeo."
            raise ValueError(msg)

        title_raw = display_title or self.DEFAULT_YT_TITLE
        title = str(title_raw).strip() or self.DEFAULT_YT_TITLE

        return url, video_id, title

    @staticmethod
    def _extract_youtube_video_id(url: str) -> str | None:
        """
        Extrai o ID do vídeo de uma URL do YouTube.

        Suporta formatos:
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        - https://www.youtube.com/shorts/VIDEO_ID

        Returns:
            ID do vídeo ou None se não for possível extrair.
        """
        from urllib.parse import parse_qs, urlparse

        try:
            parsed = urlparse(url)
            hostname = (parsed.hostname or "").lower()

            # https://youtu.be/VIDEO_ID
            if hostname == "youtu.be":
                return parsed.path.lstrip("/") or None

            # https://www.youtube.com/watch?v=VIDEO_ID
            if hostname in {"www.youtube.com", "youtube.com", "m.youtube.com"}:
                # /watch?v=...
                if parsed.path == "/watch":
                    query = parse_qs(parsed.query)
                    video_ids = query.get("v")
                    if video_ids:
                        return video_ids[0]

                # /embed/VIDEO_ID
                if parsed.path.startswith("/embed/"):
                    return parsed.path.split("/embed/", 1)[1].split("/")[0] or None

                # /shorts/VIDEO_ID
                if parsed.path.startswith("/shorts/"):
                    return parsed.path.split("/shorts/", 1)[1].split("/")[0] or None

            return None
        except Exception as exc:  # pragma: no cover - proteção extra
            logger.warning("YOUTUBE_ID_PARSE_ERROR | url={} | error={}", url, exc)
            return None

    def _get_track(self, track_id: int) -> BackgroundMusicTrack:
        """
        Obtém uma faixa por ID ou lança ValueError.

        Args:
            track_id: ID da faixa.

        Returns:
            Instância de BackgroundMusicTrack.

        Raises:
            ValueError: Se a faixa não for encontrada.
        """
        track = self.db.get(BackgroundMusicTrack, track_id)
        if track is None:
            msg = f"Faixa de música não encontrada (id={track_id})."
            raise ValueError(msg)
        return track
