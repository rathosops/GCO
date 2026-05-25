"""
Model para controle de triagem IMESC.

Pacientes IMESC precisam passar pela triagem antes do médico.
"""

from datetime import UTC, datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TriagemIMESC(Base):
    """
    Controle de triagem para pacientes IMESC.

    Registra quando um paciente passou pela triagem com a assistente social.
    O médico só pode chamar pacientes IMESC após triagem concluída.
    """

    __tablename__ = "triagem_imesc"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Vínculo com agendamento
    agendamento_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("agendamentos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Status da triagem
    triagem_concluida: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    triagem_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Quem realizou a triagem
    realizada_por_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("usuarios_chamadas.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Observações da triagem
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "agendamento_id": self.agendamento_id,
            "triagem_concluida": self.triagem_concluida,
            "triagem_em": self.triagem_em.isoformat() if self.triagem_em else None,
            "realizada_por_id": self.realizada_por_id,
            "observacoes": self.observacoes,
        }

    def __repr__(self) -> str:
        status = "concluída" if self.triagem_concluida else "pendente"
        return f"<TriagemIMESC agendamento={self.agendamento_id} ({status})>"
