"""
Model espelho da tabela agendamentos.

Esta tabela já existe no banco (criada pelo CMI-PCG-SERVER).
Este model serve apenas para o SQLAlchemy conhecer a estrutura
e permitir FKs das tabelas do sistema de chamadas.

IMPORTANTE: Não modificar esta tabela - ela é gerenciada pelo CMI-PCG-SERVER.
"""

from datetime import date, time

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Agendamentos(Base):
    """
    Tabela de agendamentos de pacientes (SOMENTE LEITURA).

    Gerenciada pelo CMI-PCG-SERVER. Este model existe apenas
    para permitir relacionamentos FK do sistema de chamadas.
    """

    __tablename__ = "agendamentos"

    # Indica que a tabela já existe - não tentar criar
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dia: Mapped[date] = mapped_column(Date, nullable=False)
    hora: Mapped[time] = mapped_column(Time, nullable=False)

    cpf_paciente: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    nome_paciente: Mapped[str | None] = mapped_column(String, nullable=True)

    procedimento: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("procedimentos.nome"),
        nullable=True,
    )

    numero_de_contato: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    numero_de_protocolo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    status: Mapped[str] = mapped_column(String, nullable=False, default="AGENDADO")
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)

    paciente_compareceu: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "dia": self.dia.isoformat() if self.dia else None,
            "hora": self.hora.isoformat() if self.hora else None,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.nome_paciente,
            "procedimento": self.procedimento,
            "numero_de_contato": self.numero_de_contato,
            "numero_de_protocolo": self.numero_de_protocolo,
            "status": self.status,
            "observacoes": self.observacoes,
            "paciente_compareceu": self.paciente_compareceu,
        }

    def __repr__(self) -> str:
        return f"<Agendamento {self.nome_paciente} em {self.dia} às {self.hora}>"
