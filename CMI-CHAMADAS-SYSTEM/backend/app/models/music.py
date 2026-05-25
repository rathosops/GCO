"""
Models para configuração de música de fundo do painel.

Permite escolher entre trilhas do sistema e vídeos do YouTube,
com suporte a playlist (várias faixas persistidas).
"""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BackgroundMusicType(StrEnum):
    """Tipo de fonte da música de fundo."""

    SYSTEM = "SYSTEM"
    YOUTUBE = "YOUTUBE"


class BackgroundMusicConfig(Base):
    """
    Configuração de música de fundo do painel.

    Mantém uma única configuração global (registro único),
    indicando se a fonte é uma trilha interna ou um vídeo do YouTube.

    Este model representa o "estado atual" que o Painel usa
    para decidir qual fonte tocar.
    """

    __tablename__ = "background_music_config"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    type: Mapped[BackgroundMusicType] = mapped_column(
        Enum(BackgroundMusicType, name="background_music_type"),
        nullable=False,
        default=BackgroundMusicType.SYSTEM,
    )

    # Caminho para trilha interna (ex: /sounds/loop_sound_1.mp3)
    system_track_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # URL completa do vídeo do YouTube, para referência/edição
    youtube_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ID do vídeo do YouTube (ex: dQw4w9WgXcQ)
    youtube_video_id: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
    )

    # Título amigável exibido no painel
    display_title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            "<BackgroundMusicConfig "
            f"type={self.type.value!r} "
            f"system_track_path={self.system_track_path!r} "
            f"youtube_video_id={self.youtube_video_id!r}>"
        )


class BackgroundMusicTrack(Base):
    """
    Faixa de música de fundo (playlist global do painel).

    Armazena diversas possíveis faixas, permitindo:
    - trilhas internas (SYSTEM)
    - vídeos / playlists do YouTube (YOUTUBE)

    O painel continua usando BackgroundMusicConfig como
    "fonte oficial atual", mas a playlist permite CRUD
    e seleção de faixas de forma estruturada.
    """

    __tablename__ = "background_music_tracks"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    type: Mapped[BackgroundMusicType] = mapped_column(
        Enum(BackgroundMusicType, name="background_music_type"),
        nullable=False,
        default=BackgroundMusicType.SYSTEM,
    )

    # Caminho para trilha interna (ex: /sounds/loop_sound_1.mp3)
    system_track_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # URL completa do vídeo do YouTube
    youtube_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ID do vídeo do YouTube (ex: dQw4w9WgXcQ)
    youtube_video_id: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
    )

    # Título amigável sugerido para exibição no painel
    display_title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Ordem na playlist (0 = primeiro)
    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        index=True,
    )

    # Permite "desativar" faixa sem apagar
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            "<BackgroundMusicTrack "
            f"id={self.id!r} "
            f"type={self.type.value!r} "
            f"system_track_path={self.system_track_path!r} "
            f"youtube_video_id={self.youtube_video_id!r} "
            f"order_index={self.order_index!r} "
            f"is_active={self.is_active!r}>"
        )
