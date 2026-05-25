"""
Model de salas/consultórios.

Permite configurar as salas disponíveis no sistema.
"""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TipoSala(StrEnum):
    """Tipo de sala."""

    CONSULTORIO = "CONSULTORIO"
    TRIAGEM = "TRIAGEM"


class Sala(Base):
    """
    Configuração de salas do sistema.

    Permite gerenciar consultórios médicos e salas de triagem.
    """

    __tablename__ = "salas_chamadas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[TipoSala] = mapped_column(
        Enum(TipoSala, name="tipo_sala"),
        nullable=False,
        default=TipoSala.CONSULTORIO,
    )
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "codigo": self.codigo,
            "nome": self.nome,
            "tipo": self.tipo.value,
            "descricao": self.descricao,
            "ativa": self.ativa,
        }

    def __repr__(self) -> str:
        return f"<Sala {self.codigo} - {self.nome}>"
