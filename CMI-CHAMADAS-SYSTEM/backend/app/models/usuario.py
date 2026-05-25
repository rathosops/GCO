"""
Model de usuários do sistema de chamadas.

Usuários podem ser: MEDICO, TRIAGEM ou ADMIN.
"""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TipoUsuario(StrEnum):
    """Tipos de usuário no sistema de chamadas."""

    MEDICO = "MEDICO"
    TRIAGEM = "TRIAGEM"
    ADMIN = "ADMIN"
    DEV = "DEV"


class UsuarioChamadas(Base):
    """
    Usuários do sistema de chamadas.

    Tabela separada dos usuários do sistema principal para controle específico.
    """

    __tablename__ = "usuarios_chamadas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[TipoUsuario] = mapped_column(
        Enum(TipoUsuario, name="tipo_usuario_chamadas"),
        nullable=False,
        default=TipoUsuario.MEDICO,
    )
    sala: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    def to_dict(self) -> dict:
        """Converte para dicionário (sem senha)."""
        return {
            "id": self.id,
            "username": self.username,
            "nome": self.nome,
            "tipo": self.tipo.value,
            "sala": self.sala,
            "ativo": self.ativo,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }

    def __repr__(self) -> str:
        return f"<UsuarioChamadas {self.username} ({self.tipo})>"
