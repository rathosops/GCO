"""Models do sistema de chamadas."""

# IMPORTANTE: Ordem de importação é crucial para FKs!

# 1. Primeiro os modelos espelho (tabelas que já existem no banco)
from app.models.procedimentos import Procedimentos
from app.models.agendamentos import Agendamentos

# 2. Depois os modelos do sistema de chamadas (sem FK externa)
from app.models.usuario import TipoUsuario, UsuarioChamadas
from app.models.sala import Sala, TipoSala

# 3. Por último os modelos com FK para agendamentos
from app.models.chamada import Chamada, StatusChamada, TipoChamada
from app.models.triagem import TriagemIMESC

# 4. Músicas de fundo (sem FKs externas)
from app.models.music import (
    BackgroundMusicConfig,
    BackgroundMusicTrack,
    BackgroundMusicType,
)

__all__ = [
    # Espelhos (existentes no CMI-PCG-SERVER)
    "Agendamentos",
    "Procedimentos",
    # Novos (sistema de chamadas)
    "Chamada",
    "Sala",
    "StatusChamada",
    "TipoChamada",
    "TipoSala",
    "TipoUsuario",
    "TriagemIMESC",
    "UsuarioChamadas",
    # Música de fundo / playlist
    "BackgroundMusicConfig",
    "BackgroundMusicTrack",
    "BackgroundMusicType",
]
