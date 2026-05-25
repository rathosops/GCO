"""
Model de chamadas de pacientes.

Registra o histórico de chamadas e estados.
"""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StatusChamada(StrEnum):
    """Status possíveis de uma chamada."""

    CHAMANDO = "CHAMANDO"
    ATENDENDO = "ATENDENDO"
    FINALIZADO = "FINALIZADO"
    NAO_COMPARECEU = "NAO_COMPARECEU"
    CANCELADO = "CANCELADO"


class TipoChamada(StrEnum):
    """Tipo de chamada (qual setor chamou)."""

    MEDICO = "MEDICO"
    TRIAGEM = "TRIAGEM"


class Chamada(Base):
    """
    Registro de chamada de paciente.

    Cada chamada está vinculada a um agendamento e registra
    quem chamou, de qual sala, e o status do atendimento.
    """

    __tablename__ = "chamadas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Vínculo com agendamento existente
    agendamento_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("agendamentos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Informações da chamada
    sala: Mapped[str] = mapped_column(String(50), nullable=False)
    tipo: Mapped[TipoChamada] = mapped_column(
        Enum(TipoChamada, name="tipo_chamada"),
        nullable=False,
    )
    chamado_por_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("usuarios_chamadas.id", ondelete="SET NULL"),
        nullable=True,
    )
    chamado_por_nome: Mapped[str] = mapped_column(String(100), nullable=False)

    # Status e timestamps
    status: Mapped[StatusChamada] = mapped_column(
        Enum(StatusChamada, name="status_chamada"),
        nullable=False,
        default=StatusChamada.CHAMANDO,
    )
    chamado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    atendido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finalizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Observações
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relacionamentos
    chamado_por = relationship("UsuarioChamadas", foreign_keys=[chamado_por_id], lazy="joined")

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "agendamento_id": self.agendamento_id,
            "sala": self.sala,
            "tipo": self.tipo.value,
            "chamado_por_id": self.chamado_por_id,
            "chamado_por_nome": self.chamado_por_nome,
            "status": self.status.value,
            "chamado_em": self.chamado_em.isoformat() if self.chamado_em else None,
            "atendido_em": self.atendido_em.isoformat() if self.atendido_em else None,
            "finalizado_em": self.finalizado_em.isoformat() if self.finalizado_em else None,
            "observacoes": self.observacoes,
        }

    def __repr__(self) -> str:
        return f"<Chamada {self.id} - {self.status}>"
