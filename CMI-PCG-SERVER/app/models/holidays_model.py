"""
Model de Feriados Customizados.

Permite cadastrar feriados locais/regionais que não estão
na lista oficial de feriados brasileiros.

Tipos de feriados:
- NACIONAL: Feriado nacional (já coberto pela lib holidays)
- ESTADUAL: Feriado estadual
- MUNICIPAL: Feriado municipal
- PONTO_FACULTATIVO: Ponto facultativo
- CLINICA: Feriado/recesso interno da clínica
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


class FeriadoTipo:
    """Enum-like para tipos de feriado."""

    NACIONAL = "NACIONAL"
    ESTADUAL = "ESTADUAL"
    MUNICIPAL = "MUNICIPAL"
    PONTO_FACULTATIVO = "PONTO_FACULTATIVO"
    CLINICA = "CLINICA"

    ALL = {NACIONAL, ESTADUAL, MUNICIPAL, PONTO_FACULTATIVO, CLINICA}


class FeriadoCustomizado(AuditableMixin, db.Model):
    """
    Tabela de feriados customizados.

    Armazena feriados que não estão na lib holidays ou que são
    específicos da clínica (recessos, pontos facultativos, etc).
    """

    __tablename__ = "feriados_customizados"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    data: date = db.Column(db.Date, nullable=False, index=True)
    nome: str = db.Column(db.String(200), nullable=False)
    tipo: str = db.Column(
        db.String(50),
        nullable=False,
        default=FeriadoTipo.CLINICA,
    )

    # Se True, a clínica não funciona neste dia
    bloqueia_agendamento: bool = db.Column(
        db.Boolean, nullable=False, default=True
    )

    # Feriado recorrente? (se True, repete todo ano na mesma data)
    recorrente: bool = db.Column(db.Boolean, nullable=False, default=False)

    # Observações opcionais
    observacoes: Optional[str] = db.Column(db.Text, nullable=True)

    # Ativo/Inativo (soft delete)
    ativo: bool = db.Column(db.Boolean, nullable=False, default=True)

    __table_args__ = (
        db.Index("ix_feriados_data_ativo", "data", "ativo"),
        db.UniqueConstraint("data", "nome", name="uq_feriado_data_nome"),
    )

    def to_dict(self) -> dict:
        """Serializa o feriado para JSON."""
        return {
            "id": self.id,
            "data": self.data.isoformat() if self.data else None,
            "nome": self.nome,
            "tipo": self.tipo,
            "bloqueia_agendamento": self.bloqueia_agendamento,
            "recorrente": self.recorrente,
            "observacoes": self.observacoes,
            "ativo": self.ativo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Feriado {self.nome} em {self.data}>"
